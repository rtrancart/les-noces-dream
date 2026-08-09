// brevo-consentement-marketing — propage vers Brevo le consentement marketing
// choisi par un membre (case RGPD à l'inscription ou interrupteur dans l'espace client).
//
// Appelée par la fonction SQL public.definir_consentement_marketing via pg_net.
// Entrée : { profile_id }
//   - consentement retiré → retrait de TOUTES les listes marketing (prestataires +
//     contact_{categorie}) puis versement dans la liste technique des désinscrits.
//   - consentement donné  → CONSENTEMENT_MKT = true, sauf opposition existante.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { brevoFetch, BrevoError, BREVO_ERROR_LABELS } from "../_shared/brevo-client.ts";
import {
  chargerListes,
  ensureListeDesinscrits,
  estListeMarketing,
  estOppose,
} from "../_shared/brevo-opposition.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const CALL_OPTIONS = { retries: 1, timeoutMs: 10_000 };

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

  return aRetirer.map((id) => listes.get(id) ?? String(id));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, message: "Méthode non autorisée" }, 405);

  let payload: { profile_id?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, message: "Corps JSON illisible" }, 400);
  }

  const profileId = String(payload.profile_id ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) {
    return json({ ok: false, message: "profile_id invalide" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: profil, error } = await admin
    .from("profiles")
    .select("email, consentement_marketing")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    console.error("[brevo-consentement] lecture profil impossible", error.message);
    return json({ ok: false, message: "Lecture profil impossible" }, 500);
  }
  if (!profil?.email) return json({ ok: true, ignore: "profil_sans_email" });

  const email = String(profil.email).toLowerCase().trim();

  try {
    if (!profil.consentement_marketing) {
      const retirees = await basculerVersListeTechnique(email);
      console.log(`[brevo-consentement] retrait ${redact(email)} listes=[${retirees.join(", ")}]`);
      return json({ ok: true, consentement: false, listes_retirees: retirees });
    }

    // Une opposition est définitive : on ne réaffirme jamais le consentement.
    if (await estOppose(admin, email)) {
      console.log(`[brevo-consentement] opposition existante, octroi ignoré ${redact(email)}`);
      return json({ ok: true, ignore: "opposition_existante" });
    }

    await brevoFetch(
      "/contacts",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          attributes: { CONSENTEMENT_MKT: true },
          updateEnabled: true,
        }),
      },
      CALL_OPTIONS,
    );
    console.log(`[brevo-consentement] consentement confirmé ${redact(email)}`);
    return json({ ok: true, consentement: true });
  } catch (err) {
    const detail = err instanceof BrevoError
      ? `${BREVO_ERROR_LABELS[err.kind]}${err.status ? ` (HTTP ${err.status})` : ""}`
      : err instanceof Error
      ? err.message
      : String(err);
    console.error(`[brevo-consentement] échec ${redact(email)} : ${detail}`);
    return json({ ok: false, message: "Propagation Brevo impossible", detail }, 500);
  }
});
