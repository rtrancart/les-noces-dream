// cron-prerender-nightly — Chaîne nocturne du pré-rendu SEO (03:00).
//
// Phase 1 « reconcile » : appelle prerender-reconcile par tranches jusqu'à
//   épuisement du recensement, puis purge des entrées non indexables.
// Phase 2 « render »    : appelle prerender-snapshots-batch en boucle
//   séquentielle jusqu'à ce que la file soit vide (jamais de parallélisme :
//   le service de rendu ne traite qu'une page à la fois).
//
// Reprise : budget de temps par passe, puis auto-relance gatée (uniquement s'il
// reste du travail) avec un compteur de sauts borné. Ce qui n'a pas été rendu
// dans la nuit est repris la nuit suivante — la file est traitée par
// updated_at croissant, aucune page n'est laissée indéfiniment de côté.
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

const BUDGET_MS = 40_000;
/** Plafond de sauts d'une même nuit : ~4 h de traitement au maximum. */
const MAX_HOPS = 400;
const BATCH_SIZE = 5;
const COOLDOWN_MS = 1_500;

type Phase = "reconcile" | "render";

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

  let body: { phase?: Phase; offset?: number; hop?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* corps vide toléré */
  }

  let phase: Phase = body.phase === "render" ? "render" : "reconcile";
  let offset = Math.max(0, Number(body.offset) || 0);
  const hop = Math.max(0, Number(body.hop) || 0);

  if (hop >= MAX_HOPS) {
    console.log(`[cron-prerender-nightly] plafond de sauts atteint (${hop}), arrêt.`);
    return json({ ok: true, termine: false, motif: "plafond_sauts", hop });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const startedAt = Date.now();

  const appeler = async (fn: string, payload: unknown) => {
    const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${fn} : HTTP ${res.status} — ${JSON.stringify(data).slice(0, 200)}`);
    return data as Record<string, unknown>;
  };

  const cumul = { reconcile: null as unknown, lots: 0, reussis: 0, echecs: 0, ignores: 0 };

  try {
    // ---- Phase 1 : réconciliation ------------------------------------------
    if (phase === "reconcile") {
      const r = await appeler("prerender-reconcile", {
        limit: 500,
        offset,
        purge: true,
        auto_relance: false,
      });
      cumul.reconcile = r;

      if (r.termine !== true) {
        offset = Number(r.relance_offset ?? offset);
      } else {
        phase = "render";
        offset = 0;
      }
    }

    // ---- Phase 2 : rendu séquentiel ----------------------------------------
    let restantes: number | null = null;
    if (phase === "render") {
      while (Date.now() - startedAt < BUDGET_MS) {
        const r = await appeler("prerender-snapshots-batch", { batch_size: BATCH_SIZE });
        cumul.lots++;
        cumul.reussis += Number(r.reussis ?? 0);
        cumul.echecs += Number(r.echecs ?? 0);
        cumul.ignores += Number(r.ignores ?? 0);
        restantes = Number(r.restantes ?? 0);

        // File vide, ou file qui ne décroît pas : on arrête la chaîne.
        if (restantes <= 0) break;
        if (Number(r.traites ?? 0) === 0) break;
        await new Promise((res) => setTimeout(res, COOLDOWN_MS));
      }
    }

    const resteDuTravail = phase === "reconcile" || (restantes !== null && restantes > 0);

    if (resteDuTravail) {
      // Saut suivant : gaté sur du travail réellement restant, avec cooldown.
      setTimeout(() => {
        fetch(`${supabaseUrl}/functions/v1/cron-prerender-nightly`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({ phase, offset, hop: hop + 1 }),
        }).catch((e) => console.error("[cron-prerender-nightly] relance échouée", e));
      }, COOLDOWN_MS);
    } else {
      const { count } = await admin
        .from("prerender_queue")
        .select("id", { count: "exact", head: true })
        .eq("statut", "a_traiter");
      console.log(`[cron-prerender-nightly] terminé au saut ${hop}, restantes=${count ?? 0}`);
    }

    return json({
      ok: true,
      hop,
      phase_suivante: resteDuTravail ? phase : null,
      offset,
      restantes,
      ...cumul,
      duree_ms: Date.now() - startedAt,
    });
  } catch (e) {
    console.error("[cron-prerender-nightly]", e);
    return json(
      { ok: false, hop, phase, offset, message: e instanceof Error ? e.message : String(e) },
      500,
    );
  }
});
