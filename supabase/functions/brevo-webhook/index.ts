// brevo-webhook — Synchro retour Brevo → base.
//
// Reçoit les signaux de non-consentement émis côté Brevo (désinscription, plainte
// spam, blocage, rebond définitif) et les matérialise en base :
//   - toujours : une opposition marketing (public.oppositions_marketing)
//   - hard_bounce uniquement : ajout à public.suppressed_emails (coupe le transactionnel)
//
// Côté Brevo, le contact est retiré de TOUTES les listes marketing où il figure
// (liste prestataires + toutes les listes contact_{categorie}, cas d'un contact
// mixte marié+prestataire) puis versé dans la liste technique desinscrits_marketing.
//
// Codes de retour :
//   200 → traité, ou payload structurellement irrécupérable (inutile de rejouer)
//   401 → secret partagé absent/invalide
//   500 → échec d'écriture ou d'appel Brevo : Brevo doit rejouer
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { brevoFetch, BrevoError, BREVO_ERROR_LABELS } from "../_shared/brevo-client.ts";
import {
  chargerListes,
  ensureListeDesinscrits,
  estListeMarketing,
} from "../_shared/brevo-opposition.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-brevo-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const CALL_OPTIONS = { retries: 1, timeoutMs: 10_000 };

type Motif = "unsubscribe" | "spam" | "blocked" | "hard_bounce";

/** Événements Brevo pris en charge → motif d'opposition normalisé. */
const MOTIFS: Record<string, Motif> = {
  unsubscribe: "unsubscribe",
  unsubscribed: "unsubscribe",
  list_addition_unsubscribe: "unsubscribe",
  spam: "spam",
  complaint: "spam",
  blocked: "blocked",
  hard_bounce: "hard_bounce",
  hardBounce: "hard_bounce",
};

/** Comparaison en temps constant : évite toute fuite par mesure de durée. */
function secretValide(fourni: string, attendu: string): boolean {
  const a = new TextEncoder().encode(fourni);
  const b = new TextEncoder().encode(attendu);
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

function redact(email: string): string {
  const [local, domaine] = email.split("@");
  return `${(local ?? "")[0] ?? "?"}***@${domaine ?? "?"}`;
}

/** Retire le contact de toutes ses listes marketing puis le verse dans la liste technique. */
async function basculerVersListeTechnique(email: string) {
  const listes = await chargerListes();
  const technique = await ensureListeDesinscrits();

  let appartenances: number[] = [];
  try {
    const contact = await brevoFetch<{ listIds?: number[] }>(
      `/contacts/${encodeURIComponent(email)}`,
      { method: "GET" },
      CALL_OPTIONS,
    );
    appartenances = contact?.listIds ?? [];
  } catch (err) {
    // Contact inconnu de Brevo : rien à retirer, on le crée dans la liste technique.
    if (!(err instanceof BrevoError) || err.kind !== "bad_request") throw err;
  }

  const aRetirer = appartenances.filter((id) => estListeMarketing(listes.get(id) ?? ""));
  for (const listId of aRetirer) {
    await brevoFetch(
      `/contacts/lists/${listId}/contacts/remove`,
      { method: "POST", body: JSON.stringify({ emails: [email] }) },
      CALL_OPTIONS,
    );
  }

  await brevoFetch(
    "/contacts",
    {
      method: "POST",
      body: JSON.stringify({
        email,
        attributes: { CONSENTEMENT_MKT: false },
        updateEnabled: true,
        listIds: [technique],
      }),
    },
    CALL_OPTIONS,
  );

  return {
    listes_retirees: aRetirer.map((id) => listes.get(id) ?? String(id)),
    liste_technique: technique,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, message: "Méthode non autorisée" }, 405);

  const attendu = Deno.env.get("BREVO_WEBHOOK_SECRET");
  if (!attendu) {
    console.error("[brevo-webhook] BREVO_WEBHOOK_SECRET absent");
    return json({ ok: false, message: "Configuration serveur incomplète" }, 500);
  }

  const url = new URL(req.url);
  const fourni = req.headers.get("x-brevo-secret") ?? url.searchParams.get("secret") ?? "";
  if (!secretValide(fourni, attendu)) {
    console.error("[brevo-webhook] secret invalide");
    return json({ ok: false, message: "Non autorisé" }, 401);
  }

  // Payload structurellement irrécupérable → 200 : rejouer ne changerait rien.
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    console.warn("[brevo-webhook] corps JSON illisible, ignoré");
    return json({ ok: true, ignore: "json_illisible" });
  }

  const evenement = String(payload.event ?? payload.type ?? "").trim();
  const email = String(payload.email ?? payload.contact_email ?? "").toLowerCase().trim();
  const motif = MOTIFS[evenement];

  if (!email || !motif) {
    console.log(`[brevo-webhook] signal ignoré event=${evenement || "?"} email=${email ? "oui" : "non"}`);
    return json({ ok: true, ignore: "signal_non_traite", event: evenement });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1) Opposition marketing (append-only, idempotente sur l'email)
  const { error: oppositionError } = await admin
    .from("oppositions_marketing")
    .upsert(
      { email, motif, source: "brevo_webhook", metadata: { event: evenement } },
      { onConflict: "email", ignoreDuplicates: true },
    );
  if (oppositionError) {
    console.error("[brevo-webhook] écriture opposition impossible", oppositionError.message);
    return json({ ok: false, message: "Écriture opposition impossible" }, 500);
  }

  // 2) hard_bounce : coupe aussi le canal transactionnel.
  //    Un échec d'écriture ici doit être rejoué par Brevo, jamais avalé en 200.
  if (motif === "hard_bounce") {
    const { error: suppressionError } = await admin
      .from("suppressed_emails")
      .upsert(
        { email, reason: "bounce", metadata: { source: "brevo_webhook", event: evenement } },
        { onConflict: "email" },
      );
    if (suppressionError) {
      console.error("[brevo-webhook] écriture suppression impossible", suppressionError.message);
      return json({ ok: false, message: "Écriture suppression impossible" }, 500);
    }
  }

  // 3) Côté Brevo : sortie de toutes les listes marketing + liste technique.
  try {
    const res = await basculerVersListeTechnique(email);
    console.log(
      `[brevo-webhook] ${motif} traité ${redact(email)} retiré de [${res.listes_retirees.join(", ")}]`,
    );
    return json({ ok: true, motif, ...res });
  } catch (err) {
    const detail = err instanceof BrevoError
      ? `${BREVO_ERROR_LABELS[err.kind]}${err.status ? ` (HTTP ${err.status})` : ""}`
      : err instanceof Error
      ? err.message
      : String(err);
    console.error(`[brevo-webhook] bascule listes impossible ${redact(email)} : ${detail}`);
    return json({ ok: false, message: "Bascule des listes Brevo impossible", detail }, 500);
  }
});
