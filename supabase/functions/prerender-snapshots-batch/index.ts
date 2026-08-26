// prerender-snapshots-batch — Génère les snapshots HTML pour les crawlers
// Traite la file prerender_queue par petits lots, en appelant un service de
// rendu Browserless v2 auto-hébergé, puis écrit le HTML dans le bucket
// prerender-snapshots. Modèle de tolérance aux pannes calqué sur
// migrate-photos-batch et brevo-sync-compteurs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const DEFAULT_BATCH_SIZE = 5;
const MAX_BATCH_SIZE = 15;
const DEFAULT_MAX_TENTATIVES = 3;
const DEFAULT_DELAI_MS = 1500;
/** Budget de temps d'une passe : au-delà on s'arrête proprement pour laisser une nouvelle invocation reprendre. */
const BUDGET_MS = 40_000;
const BUCKET = "prerender-snapshots";
const READY_TIMEOUT_MS = 30_000;

function storagePathFromUrlPath(urlPath: string): string {
  // Trim leading slash and normalize trailing .html if absent.
  const clean = urlPath.replace(/^\/+/, "").replace(/\/$/, "index");
  const slug = clean || "index";
  return `pages/${slug}.html`;
}

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1]
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function truncate(str: string, max = 500): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const claims = parseJwtClaims(token);
  if (token !== serviceRoleKey && claims?.role !== "service_role") {
    return json({ ok: false, message: "Non autorisé" }, 401);
  }

  const serviceUrl = Deno.env.get("PRERENDER_SERVICE_URL");
  const serviceToken = Deno.env.get("PRERENDER_SERVICE_TOKEN");
  if (!serviceUrl || !serviceToken) {
    return json(
      { ok: false, message: "Secrets PRERENDER_SERVICE_URL ou PRERENDER_SERVICE_TOKEN manquants" },
      500,
    );
  }

  const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "https://lesnoces.net";

  let body: {
    batch_size?: number;
    max_tentatives?: number;
    delai_ms?: number;
    dry_run?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* corps vide toléré */
  }

  const batchSize = Math.min(
    MAX_BATCH_SIZE,
    Math.max(1, Number.isFinite(body.batch_size) ? Number(body.batch_size) : DEFAULT_BATCH_SIZE),
  );
  const maxTentatives = Math.max(
    1,
    Number.isFinite(body.max_tentatives) ? Number(body.max_tentatives) : DEFAULT_MAX_TENTATIVES,
  );
  const delaiMs = Math.max(
    0,
    Number.isFinite(body.delai_ms) ? Number(body.delai_ms) : DEFAULT_DELAI_MS,
  );
  const dryRun = body.dry_run === true;

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const startedAt = Date.now();
  let traites = 0;
  let reussis = 0;
  let echecs = 0;
  let ignores = 0;
  let abandonnes = 0;

  try {
    const { data: queue, error: readErr } = await admin
      .from("prerender_queue")
      .select(
        "id, url_path, page_type, source_id, signature_visible, signature_rendue, tentatives",
      )
      .eq("statut", "a_traiter")
      .order("updated_at", { ascending: true })
      .limit(batchSize);

    if (readErr) throw new Error(`Lecture file impossible : ${readErr.message}`);

    const entries = queue ?? [];
    if (entries.length === 0) {
      const { count } = await admin
        .from("prerender_queue")
        .select("id", { count: "exact", head: true })
        .eq("statut", "a_traiter");
      return json({
        ok: true,
        termine: true,
        traites: 0,
        reussis: 0,
        echecs: 0,
        ignores: 0,
        abandonnes: 0,
        restantes: count ?? 0,
        duree_ms: Date.now() - startedAt,
      });
    }

    for (const entry of entries) {
      traites++;
      const id = entry.id as string;
      const urlPath = entry.url_path as string;
      const visibleSig = entry.signature_visible as string | null | undefined;
      const renderedSig = entry.signature_rendue as string | null | undefined;

      // 1. Court-circuit si le contenu visible n'a pas changé.
      if (visibleSig && renderedSig && visibleSig === renderedSig) {
        ignores++;
        if (!dryRun) {
          await admin
            .from("prerender_queue")
            .update({
              statut: "a_jour",
              tentatives: 0,
              dernier_motif: null,
              dernier_status: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id);
        }
        continue;
      }

      // Sécurité budget temps avant un nouveau rendu long.
      if (Date.now() - startedAt > BUDGET_MS) {
        break;
      }

      const absoluteUrl = `${siteUrl.replace(/\/$/, "")}${urlPath}`;
      const storagePath = storagePathFromUrlPath(urlPath);

      let html: string | null = null;
      let status: number | null = null;
      let motif: string | null = null;

      try {
        if (dryRun) {
          throw new Error("dry_run");
        }

        const renderUrl = `${serviceUrl.replace(/\/$/, "")}/chromium/content?token=${encodeURIComponent(serviceToken)}`;
        const res = await fetch(renderUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: absoluteUrl,
            waitForFunction: {
              fn: "() => window.__PRERENDER_READY__ === true",
              timeout: READY_TIMEOUT_MS,
            },
          }),
        });

        status = res.status;
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status} : ${truncate(text, 200)}`);
        }

        html = await res.text();
        if (!html || html.length === 0) {
          throw new Error("Rendu vide");
        }
      } catch (e) {
        motif = (e as Error).message;
        if (motif === "dry_run") {
          // En dry_run on ne compte pas d'échec, on saute juste l'écriture.
          reussis++;
          continue;
        }
      }

      if (!html || motif) {
        echecs++;
        const newTentatives = ((entry.tentatives as number) ?? 0) + 1;
        const shouldAbandon = newTentatives >= maxTentatives;
        if (!dryRun) {
          await admin
            .from("prerender_queue")
            .update({
              statut: shouldAbandon ? "abandonne" : "a_traiter",
              tentatives: newTentatives,
              dernier_motif: truncate(motif ?? "inconnu"),
              dernier_status: status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id);
        }
        if (shouldAbandon) abandonnes++;
      } else {
        try {
          const bytes = new TextEncoder().encode(html);
          const { error: uploadErr } = await admin.storage
            .from(BUCKET)
            .upload(storagePath, bytes, {
              contentType: "text/html; charset=utf-8",
              upsert: true,
            });

          if (uploadErr) throw new Error(`Storage : ${uploadErr.message}`);

          reussis++;
          if (!dryRun) {
            await admin
              .from("prerender_queue")
              .update({
                statut: "a_jour",
                signature_rendue: visibleSig,
                storage_path: storagePath,
                rendu_le: new Date().toISOString(),
                tentatives: 0,
                dernier_motif: null,
                dernier_status: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", id);
          }
          // Libère la référence pour éviter tout cumul en mémoire.
          html = null;
        } catch (e) {
          echecs++;
          const newTentatives = ((entry.tentatives as number) ?? 0) + 1;
          const shouldAbandon = newTentatives >= maxTentatives;
          if (!dryRun) {
            await admin
              .from("prerender_queue")
              .update({
                statut: shouldAbandon ? "abandonne" : "a_traiter",
                tentatives: newTentatives,
                dernier_motif: truncate((e as Error).message ?? "upload_failed"),
                dernier_status: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", id);
          }
          if (shouldAbandon) abandonnes++;
        }
      }

      if (delaiMs > 0) await sleep(delaiMs);
    }

    const { count: restantes } = await admin
      .from("prerender_queue")
      .select("id", { count: "exact", head: true })
      .eq("statut", "a_traiter");

    return json({
      ok: true,
      termine: entries.length === 0 || (Date.now() - startedAt <= BUDGET_MS && traites === entries.length),
      traites,
      reussis,
      echecs,
      ignores,
      abandonnes,
      restantes: restantes ?? 0,
      duree_ms: Date.now() - startedAt,
      ...(dryRun ? { dry_run: true } : {}),
    });
  } catch (e) {
    return json(
      {
        ok: false,
        message: e instanceof Error ? e.message : String(e),
        traites,
        reussis,
        echecs,
        ignores,
        abandonnes,
      },
      500,
    );
  }
});
