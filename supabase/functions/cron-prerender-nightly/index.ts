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
// priorité (trigger trg_prerender_priorite), arrêt : file vide, 05:30 UTC ou MAX_HOPS.
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

const BUDGET_MS = 50_000;
/** Plafond de sauts d'une même nuit : ~4 h de traitement au maximum. */
const MAX_HOPS = 400;
const BATCH_SIZE = 10;
const COOLDOWN_MS = 1_500;
/** Filet de sécurité : snapshots de plus de 30 jours, 100 max par nuit (le socle est rafraîchi chaque nuit en plus). */
const LOT_AGE = 100;
const SEUIL_AGE = "30 days";
/** Heure limite de la chaîne nocturne (UTC). */
const FIN_UTC = { h: 5, m: 30 };
const apresFin = () => {
  const d = new Date();
  return d.getUTCHours() * 60 + d.getUTCMinutes() >= FIN_UTC.h * 60 + FIN_UTC.m && d.getUTCHours() < 12;
};
type Nuit = { sauts: number; pages: number; echecs: number; ignores: number };
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

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

  let body: { phase?: Phase; offset?: number; hop?: number; lot_age?: number; nuit?: Nuit; chaine?: string; origine?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* corps vide toléré */
  }

  let phase: Phase = body.phase === "render" ? "render" : "reconcile";
  let offset = Math.max(0, Number(body.offset) || 0);
  const hop = Math.max(0, Number(body.hop) || 0);
  // Identifiant de chaîne pour le verrou anti-concurrence (repris de saut en saut).
  const chaine = typeof body.chaine === "string" && body.chaine ? body.chaine : crypto.randomUUID();
  const origine = typeof body.origine === "string" ? body.origine.slice(0, 40) : (hop === 0 ? "cron_ou_manuel" : "chaine_existante");

  const nuit: Nuit = {
    sauts: Number(body.nuit?.sauts) || 0,
    pages: Number(body.nuit?.pages) || 0,
    echecs: Number(body.nuit?.echecs) || 0,
    ignores: Number(body.nuit?.ignores) || 0,
  };
  const journal = (motif: string, restantes: number | null) =>
    console.log(
      `[cron-prerender-nightly] BILAN NUIT — sauts=${nuit.sauts} pages=${nuit.pages} echecs=${nuit.echecs} ignores=${nuit.ignores} restantes=${restantes ?? "?"} arret=${motif}`,
    );

  if (hop >= MAX_HOPS) {
    journal("max_hops", null);
    return json({ ok: true, termine: true, motif: "max_hops", hop, nuit });
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

  // Export KPI : une seule fois par nuit (premier appel du cron, sans phase),
  // exécuté dans le finally pour tourner même si le pré-rendu échoue, et
  // isolé pour ne jamais modifier le résultat du pré-rendu.
  const premierAppelDeLaNuit = hop === 0 && body.nuit === undefined;
  const exporterKpi = async () => {
    if (!premierAppelDeLaNuit) return;
    try {
      const ctrl = new AbortController();
      const minuterie = setTimeout(() => ctrl.abort(), 120_000);
      const res = await fetch(`${supabaseUrl}/functions/v1/kpi-export-sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
        body: "{}",
        signal: ctrl.signal,
      }).finally(() => clearTimeout(minuterie));
      const txt = await res.text().catch(() => "");
      console.log(`[cron-prerender-nightly] export KPI : HTTP ${res.status} — ${txt.slice(0, 300)}`);
    } catch (e) {
      console.error("[cron-prerender-nightly] export KPI échoué (sans effet sur le pré-rendu)", e);
    }
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
        // Fin de réconciliation : on ajoute le lot tournant par l'âge
        // (accueil/régions/catégories d'abord, puis articles/pages, puis fiches).
        const lotAge = Math.max(0, Number(body.lot_age ?? LOT_AGE));
        const { data: nAge, error: eAge } = await admin.rpc(
          "prerender_planifier_rafraichissement",
          { p_limit: lotAge, p_age: SEUIL_AGE },
        );
        if (eAge) console.error("[cron-prerender-nightly] planification par l'âge", eAge.message);
        else console.log(`[cron-prerender-nightly] ${nAge} snapshot(s) anciens remis en file`);
      }
    }

    // ---- Phase 2 : rendu séquentiel ----------------------------------------
    let restantes: number | null = null;
    let bloquee = false;
    let dejaActive = false;
    let verrouPerdu = false;
    if (phase === "render") {
      // Prend (ou renouvelle) le verrou : une seule chaîne de rendu à la fois.
      const { data: ok, error: eV } = await admin.rpc("prerender_verrou_prendre", { p_chaine: chaine, p_origine: origine });
      if (eV) throw new Error(`verrou : ${eV.message}`);
      if (ok !== true) {
        dejaActive = true;
        console.log("[cron-prerender-nightly] chaîne déjà active : pas de rendu dans cette chaîne");
      }
    }
    if (phase === "render" && !dejaActive) {
      while (Date.now() - startedAt < BUDGET_MS && !apresFin()) {
        const r = await appeler("prerender-snapshots-batch", { batch_size: BATCH_SIZE });
        cumul.lots++;
        cumul.reussis += Number(r.reussis ?? 0);
        cumul.echecs += Number(r.echecs ?? 0);
        cumul.ignores += Number(r.ignores ?? 0);
        nuit.pages += Number(r.reussis ?? 0);
        nuit.echecs += Number(r.echecs ?? 0);
        nuit.ignores += Number(r.ignores ?? 0);
        restantes = Number(r.restantes ?? 0);
        const { data: vivant } = await admin.rpc("prerender_verrou_battre", { p_chaine: chaine });
        if (vivant !== true) { verrouPerdu = true; break; }

        // File vide, ou file qui ne décroît pas : on arrête la chaîne.
        if (restantes <= 0) break;
        if (Number(r.traites ?? 0) === 0) { bloquee = true; break; }
        await new Promise((res) => setTimeout(res, COOLDOWN_MS));
      }
    }

    nuit.sauts++;
    let motif: string | null = null;
    if (dejaActive) motif = "chaine_deja_active";
    else if (verrouPerdu) motif = "verrou_perdu";
    else if (phase === "render" && restantes !== null && restantes <= 0) motif = "file_vide";
    else if (bloquee) motif = "file_bloquee";
    else if (apresFin()) motif = "heure_limite_0530";
    else if (hop + 1 >= MAX_HOPS) motif = "max_hops";
    else if (phase === "render" && restantes === null) motif = "aucun_lot";
    const resteDuTravail = motif === null;

    if (resteDuTravail) {
      // Saut suivant rattaché au runtime : il part après la réponse sans être coupé.
      const relance = (async () => {
        await new Promise((r) => setTimeout(r, COOLDOWN_MS));
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/cron-prerender-nightly`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({ phase, offset, hop: hop + 1, nuit, chaine, origine }),
          });
          await res.body?.cancel();
        } catch (e) {
          console.error("[cron-prerender-nightly] relance échouée", e);
          journal("relance_echouee", restantes);
        }
      })();
      if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(relance);
      else await relance;
    } else {
      if (!dejaActive) await admin.rpc("prerender_verrou_rendre", { p_chaine: chaine });
      const { count } = await admin
        .from("prerender_queue")
        .select("id", { count: "exact", head: true })
        .eq("statut", "a_traiter");
      journal(motif!, count ?? 0);
    }

    return json({
      ok: true,
      hop,
      phase_suivante: resteDuTravail ? phase : null,
      motif_arret: motif,
      nuit,
      offset,
      restantes,
      ...cumul,
      duree_ms: Date.now() - startedAt,
    });
  } catch (e) {
    console.error("[cron-prerender-nightly]", e);
    journal("erreur", null);
    await admin.rpc("prerender_verrou_rendre", { p_chaine: chaine }).then(() => {}, () => {});
    return json(
      { ok: false, hop, phase, offset, message: e instanceof Error ? e.message : String(e) },
      500,
    );
  } finally {
    await exporterKpi();
  }
});
