// cron-monitoring-alertes — Surveillance horaire des pannes silencieuses.
//
// Symptômes surveillés :
//   1. http_401        : un appel de tâche planifiée refusé (401) dans la dernière heure
//                        — exactement le symptôme de l'incident du secret Vault.
//   2. sync_bloquee    : un event Brevo reste « a_rejouer » depuis plus de 2 h
//                        (la reprise tourne tous les quarts d'heure).
//   3. prerender_fige  : aucun snapshot rendu depuis plus de 30 h.
//   4. prerender_file_bloquee : pages abandonnées ou en attente de capture > 12 h.
//
// Anti-doublon : verrou en base (public.monitoring_alerte_verrou) posé AVANT
// l'envoi, libéré si l'envoi échoue — même schéma que les autres crons.
// Une alerte par symptôme toutes les 24 h au maximum.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://lesnoces.net";
const SEUIL_PRERENDER_HEURES = 30;
/** Une page en attente de capture au-delà de ce délai signale un blocage. */
const SEUIL_FILE_HEURES = 12;

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

function heureParis(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(d);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: s, error } = await admin.rpc("monitoring_symptomes");
  if (error) {
    console.error("[cron-monitoring-alertes] lecture des symptômes échouée", error);
    return json({ ok: false, message: error.message }, 500);
  }
  const sym = (s ?? {}) as Record<string, unknown>;

  const alertes: Array<{ cle: string; symptome: string; explication: string; detail: string; lien: string }> = [];

  const nb401 = Number(sym.http_401_nb ?? 0);
  if (nb401 > 0) {
    alertes.push({
      cle: "http_401",
      symptome: "Appels internes refusés (401)",
      explication:
        "Des tâches planifiées se font refuser l'accès au serveur. Les emails automatiques et les synchronisations peuvent être interrompus. Vérifier la clé interne utilisée par les tâches planifiées.",
      detail: `${nb401} appel(s) refusé(s) dans la dernière heure, premier à ${heureParis(sym.http_401_premier as string)} (heure de Paris).`,
      lien: `${SITE_URL}/admin/emails-suivi`,
    });
  }

  const nbBloques = Number(sym.sync_bloques_nb ?? 0);
  if (nbBloques > 0) {
    alertes.push({
      cle: "sync_bloquee",
      symptome: "Synchronisation CRM bloquée",
      explication:
        "Des événements restent en attente de renvoi vers le CRM depuis plus de 2 heures. Les fiches et les contacts ne sont plus à jour côté marketing.",
      detail: `${nbBloques} événement(s) en attente, le plus ancien depuis ${heureParis(sym.sync_bloques_depuis as string)} (heure de Paris).`,
      lien: `${SITE_URL}/admin/connecteurs`,
    });
  }

  const heuresPrerender = sym.prerender_dernier_rendu == null
    ? null
    : Number(sym.prerender_heures ?? 0);
  if (heuresPrerender !== null && heuresPrerender > SEUIL_PRERENDER_HEURES) {
    alertes.push({
      cle: "prerender_fige",
      symptome: "Pages pré-rendues figées",
      explication:
        "La tâche nocturne de rafraîchissement des pages pour les moteurs de recherche ne tourne plus. Les pages servies aux robots restent celles de la dernière exécution réussie.",
      detail: `Dernier rafraîchissement le ${heureParis(sym.prerender_dernier_rendu as string)} (heure de Paris), soit il y a ${heuresPrerender} h.`,
      lien: `${SITE_URL}/admin/prestataires`,
    });
  }

  // 4. Pages coincées dans la file de capture : abandonnées, ou en attente
  // depuis plus de 12 h alors que la capture tourne chaque nuit.
  const limite12h = new Date(Date.now() - SEUIL_FILE_HEURES * 3_600_000).toISOString();
  const [{ count: nbAbandon }, { count: nbEnAttente }] = await Promise.all([
    admin
      .from("prerender_queue")
      .select("id", { count: "exact", head: true })
      .eq("statut", "abandonne"),
    admin
      .from("prerender_queue")
      .select("id", { count: "exact", head: true })
      .eq("statut", "a_traiter")
      .lt("updated_at", limite12h),
  ]);
  const nbCoincees = (nbAbandon ?? 0) + (nbEnAttente ?? 0);
  if (nbCoincees > 0) {
    alertes.push({
      cle: "prerender_file_bloquee",
      symptome: "Pages bloquées avant publication aux moteurs",
      explication:
        "Des pages ne parviennent pas à être capturées pour les moteurs de recherche. Tant que la capture échoue, les robots voient la version applicative et non la page complète.",
      detail: `${nbAbandon ?? 0} page(s) abandonnée(s) après plusieurs échecs et ${nbEnAttente ?? 0} page(s) en attente depuis plus de ${SEUIL_FILE_HEURES} h.`,
      lien: `${SITE_URL}/admin/categories`,
    });
  }

  let envoyes = 0;
  let ignores = 0;
  for (const a of alertes) {
    const { data: verrou, error: verrouErr } = await admin.rpc("monitoring_alerte_verrou", {
      p_cle: a.cle,
      p_details: sym,
    });
    if (verrouErr) {
      console.error("[cron-monitoring-alertes] verrou échoué", a.cle, verrouErr);
      continue;
    }
    if (verrou !== true) {
      ignores++; // déjà alerté dans les 24 dernières heures
      continue;
    }

    const { error: invokeErr } = await admin.functions.invoke("send-app-email", {
      body: {
        templateName: "alerte_technique_admin",
        recipientEmail: "rodolphe@lesnoces.net",
        idempotencyKey: `alerte-${a.cle}-${new Date().toISOString().slice(0, 13)}`,
        templateData: {
          symptome: a.symptome,
          explication: a.explication,
          detail: a.detail,
          lien: a.lien,
        },
      },
    });

    if (invokeErr) {
      console.error("[cron-monitoring-alertes] envoi échoué", a.cle, invokeErr);
      await admin.rpc("monitoring_alerte_liberer", { p_cle: a.cle });
    } else {
      envoyes++;
    }
  }

  return json({ ok: true, symptomes: sym, alertes: alertes.map((a) => a.cle), envoyes, ignores });
});
