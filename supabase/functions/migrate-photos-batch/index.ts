import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE = "https://www.lesnoces.net/data/prestataire/";
const BUCKET = "prestataires-photos";
const DEFAULT_BATCH = 20;
const MAX_BATCH = 50;

type MappingRow = {
  legacy_id: number;
  photo_principale: string | null;
  galerie: string[] | null;
};

type UploadOk = { kind: "principale" | "galerie"; filename: string; ok: true; publicUrl: string };
type UploadKo = { kind: "principale" | "galerie"; filename: string; ok: false; error: string };
type UploadResult = UploadOk | UploadKo;

function extOf(filename: string): string {
  const parts = filename.split(".");
  return (parts.length > 1 ? parts.pop()! : "jpg").toLowerCase();
}

function contentTypeFor(ext: string, fallback: string | null): string {
  if (fallback && fallback.startsWith("image/")) return fallback;
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return `image/${ext}`;
}

async function uploadOne(
  supabase: ReturnType<typeof createClient>,
  uuid: string,
  kind: "principale" | "galerie",
  filename: string,
): Promise<UploadResult> {
  try {
    const url = BASE + filename;
    const r = await fetch(url);
    if (!r.ok) return { kind, filename, ok: false, error: `HTTP ${r.status}` };
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.byteLength === 0) return { kind, filename, ok: false, error: "empty body" };
    const ext = extOf(filename);
    const path = `${uuid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const contentType = contentTypeFor(ext, r.headers.get("content-type"));
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType,
      upsert: false,
    });
    if (error) return { kind, filename, ok: false, error: `storage: ${error.message}` };
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { kind, filename, ok: true, publicUrl: data.publicUrl };
  } catch (e) {
    return { kind, filename, ok: false, error: `exception: ${(e as Error).message}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const urlObj = new URL(req.url);
  const requested = parseInt(urlObj.searchParams.get("batch_size") || "", 10);
  const batchSize = Math.min(
    MAX_BATCH,
    Math.max(1, Number.isFinite(requested) ? requested : DEFAULT_BATCH),
  );

  // 1) Fetch next batch of untreated mapping rows
  const { data: batch, error: batchErr } = await supabase
    .from("migration_photos_mapping")
    .select("legacy_id, photo_principale, galerie")
    .eq("traite", false)
    .order("legacy_id", { ascending: true })
    .limit(batchSize);

  if (batchErr) {
    return new Response(JSON.stringify({ error: batchErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows = (batch ?? []) as MappingRow[];
  if (rows.length === 0) {
    const { count } = await supabase
      .from("migration_photos_mapping")
      .select("legacy_id", { count: "exact", head: true })
      .eq("traite", false);
    return new Response(
      JSON.stringify({ done: true, batch_size: batchSize, restantes: count ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 2) Resolve legacy_id -> prestataire UUID (single query, strict word boundary).
  //    POSIX \M = end-of-word => '17' never matches '170', '7' never matches '70'.
  const legacyIds = rows.map((r) => r.legacy_id);
  const legacyIdsSet = new Set(legacyIds);
  const idsAlt = legacyIds.join("|");
  const regex = `\\[legacy_id\\]\\s+(${idsAlt})\\M`;

  const { data: prestas, error: presErr } = await supabase
    .from("prestataires")
    .select("id, notes_pre_inscription")
    .filter("notes_pre_inscription", "~", regex);

  if (presErr) {
    return new Response(JSON.stringify({ error: `lookup: ${presErr.message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const map = new Map<number, string>();
  for (const p of prestas ?? []) {
    const row = p as { id: string; notes_pre_inscription: string | null };
    if (!row.notes_pre_inscription) continue;
    // TS-side strict word boundary (\b) — double safety on top of the SQL \M filter.
    const m = row.notes_pre_inscription.match(/\[legacy_id\]\s+(\d+)\b/);
    if (!m) continue;
    const lid = parseInt(m[1], 10);
    if (legacyIdsSet.has(lid) && !map.has(lid)) map.set(lid, row.id);
  }

  // 3) Process each row
  const details: unknown[] = [];
  let fichesTraitees = 0;
  let fichesSansPresta = 0;
  let fichiersOk = 0;
  let fichiersKo = 0;

  for (const row of rows) {
    const uuid = map.get(row.legacy_id);

    if (!uuid) {
      // Never mark as traite — must remain visible and separately actionable.
      await supabase
        .from("migration_photos_mapping")
        .update({ traite: false, erreurs: "prestataire introuvable" })
        .eq("legacy_id", row.legacy_id);
      fichesSansPresta++;
      details.push({ legacy_id: row.legacy_id, uuid: null, status: "prestataire introuvable" });
      continue;
    }

    try {
      const tasks: Promise<UploadResult>[] = [];
      if (row.photo_principale) {
        tasks.push(uploadOne(supabase, uuid, "principale", row.photo_principale));
      }
      const galerieNames = row.galerie ?? [];
      for (const f of galerieNames) {
        tasks.push(uploadOne(supabase, uuid, "galerie", f));
      }

      // Promise.allSettled: one failure NEVER interrupts the others.
      const settled = await Promise.allSettled(tasks);

      const errorsLog: string[] = [];
      const update: Record<string, unknown> = {};
      const galerieUrls: string[] = [];
      let principaleResult: UploadResult | null = null;

      for (const s of settled) {
        if (s.status === "fulfilled") {
          const res = s.value;
          if (res.kind === "principale") principaleResult = res;
          if (res.ok) {
            fichiersOk++;
            if (res.kind === "principale") {
              update.photo_principale_url = res.publicUrl;
            } else {
              galerieUrls.push(res.publicUrl);
            }
          } else {
            fichiersKo++;
            errorsLog.push(`${res.kind}:${res.filename}:${res.error}`);
          }
        } else {
          // uploadOne has its own try/catch, so a rejection here is theoretically
          // impossible — but allSettled is the belt on top of the suspenders.
          fichiersKo++;
          errorsLog.push(`unknown:rejected:${String(s.reason)}`);
        }
      }

      // Principale KO => photo_principale_url NOT included => existing value preserved.
      update.urls_galerie = galerieUrls;

      const { error: upErr } = await supabase
        .from("prestataires")
        .update(update)
        .eq("id", uuid);

      if (upErr) {
        await supabase
          .from("migration_photos_mapping")
          .update({ traite: false, erreurs: `db update: ${upErr.message}` })
          .eq("legacy_id", row.legacy_id);
        details.push({
          legacy_id: row.legacy_id,
          uuid,
          status: "db_update_failed",
          error: upErr.message,
        });
        continue;
      }

      await supabase
        .from("migration_photos_mapping")
        .update({
          traite: true,
          erreurs: errorsLog.length > 0 ? errorsLog.join("\n") : null,
        })
        .eq("legacy_id", row.legacy_id);

      fichesTraitees++;
      details.push({
        legacy_id: row.legacy_id,
        uuid,
        principale: row.photo_principale
          ? (principaleResult && principaleResult.ok ? "ok" : "ko")
          : "none",
        galerie_ok: galerieUrls.length,
        galerie_ko: galerieNames.length - galerieUrls.length,
      });
    } catch (e) {
      // Fiche-level catch-all — only reachable on truly structural errors
      // (never on a single file failure, thanks to allSettled).
      await supabase
        .from("migration_photos_mapping")
        .update({ traite: false, erreurs: `exception: ${(e as Error).message}` })
        .eq("legacy_id", row.legacy_id);
      details.push({
        legacy_id: row.legacy_id,
        uuid,
        status: "exception",
        error: (e as Error).message,
      });
    }
  }

  const { count: restantes } = await supabase
    .from("migration_photos_mapping")
    .select("legacy_id", { count: "exact", head: true })
    .eq("traite", false);

  return new Response(
    JSON.stringify(
      {
        batch_size: batchSize,
        fiches_traitees: fichesTraitees,
        fiches_sans_prestataire: fichesSansPresta,
        fichiers_ok: fichiersOk,
        fichiers_ko: fichiersKo,
        restantes: restantes ?? null,
        details,
      },
      null,
      2,
    ),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
