// notify-nouveau-contact-presta — Envoi des emails liés à une demande de devis.
// Déclenché par la base (trigger + rattrapage nocturne), jamais par le navigateur.
//  - kind "prestataire" : notifie le prestataire d'une demande validée (moderation = 'valide').
//  - kind "admin"       : alerte l'admin d'une demande à vérifier (moderation = 'a_verifier').
// Garde-fou anti-doublon : la date d'envoi est réservée atomiquement (« seulement si vide »)
// avant l'envoi, puis remise à NULL si la mise en file échoue. L'appel ne transporte donc
// aucun secret : un appel répété ou externe ne peut ni dupliquer ni contourner la modération.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const OBJET_LABEL: Record<string, string> = {
  mariage: "Mariage",
  evenement_entreprise: "Événement d'entreprise",
  cocktail: "Cocktail",
  autre: "Autre",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDateFr(iso?: string | null): string | undefined {
  if (!iso) return undefined;
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://lesnoces.net";

  let ids: string[] = [];
  let kind: "prestataire" | "admin" = "prestataire";
  let simulerEchec = false;
  try {
    const body = await req.json();
    const raw = Array.isArray(body?.demande_ids) ? body.demande_ids : body?.demande_id ? [body.demande_id] : [];
    ids = raw.filter((x: unknown) => typeof x === "string" && UUID_RE.test(x)).slice(0, 200);
    if (body?.kind === "admin") kind = "admin";
    // Test uniquement : réservé à la clé de service.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
    simulerEchec = body?.simuler_echec === true && token === SERVICE_KEY;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (ids.length === 0) return json({ error: "demande_ids requis" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const col = kind === "admin" ? "email_admin_envoye_le" : "email_prestataire_envoye_le";
  const moderationAttendue = kind === "admin" ? "a_verifier" : "valide";
  const resultats: Record<string, string> = {};

  for (const id of ids) {
    // 1. Réservation atomique
    const { data: reserve, error: resErr } = await admin
      .from("demandes_devis")
      .update({ [col]: new Date().toISOString() })
      .eq("id", id)
      .eq("moderation", moderationAttendue)
      .is(col, null)
      .select("id");
    if (resErr) { resultats[id] = `erreur_reservation: ${resErr.message}`; continue; }
    if (!reserve || reserve.length === 0) { resultats[id] = "deja_traitee_ou_non_eligible"; continue; }

    const liberer = async (motif: string) => {
      await admin.from("demandes_devis").update({ [col]: null }).eq("id", id);
      resultats[id] = `echec_libere: ${motif}`;
    };

    try {
      const { data: d, error: dErr } = await admin
        .from("demandes_devis")
        .select(`
          id, profile_id, nom_contact, email_contact, telephone_contact, objet, message,
          date_evenement, lieu_evenement, nombre_invites_rang, score_suspicion, raisons_suspicion,
          prestataire:prestataires!demandes_devis_prestataire_id_fkey (
            id, nom_commercial, email_contact,
            categorie:categories!prestataires_categorie_mere_id_fkey ( nom )
          )
        `)
        .eq("id", id)
        .maybeSingle();
      if (dErr || !d || !d.prestataire) { await liberer("demande introuvable"); continue; }

      const presta = d.prestataire as unknown as {
        id: string; nom_commercial: string; email_contact: string | null; categorie: { nom: string } | null;
      };

      let templateName: string;
      let recipientEmail: string;
      let templateData: Record<string, unknown>;

      if (kind === "admin") {
        templateName = "alerte_demande_suspecte";
        recipientEmail = "rodolphe@lesnoces.net";
        templateData = {
          prestataireNom: presta.nom_commercial,
          contactNom: d.nom_contact,
          contactEmail: d.email_contact,
          contactTelephone: d.telephone_contact ?? undefined,
          lieuEvenement: d.lieu_evenement ?? undefined,
          nombreInvites: d.nombre_invites_rang ?? undefined,
          message: d.message,
          score: d.score_suspicion,
          raisons: d.raisons_suspicion ?? [],
          lien: `${SITE_URL}/admin/demandes?demande=${d.id}`,
        };
      } else {
        if (!presta.email_contact) { await liberer("prestataire sans email"); continue; }
        templateName = d.profile_id ? "notif_nouveau_contact_presta" : "notif_nouveau_contact_presta_sans_compte";
        recipientEmail = presta.email_contact;
        templateData = {
          prestataireNom: presta.nom_commercial,
          clientPrenom: d.nom_contact ? d.nom_contact.split(" ")[0] : undefined,
          categorie: presta.categorie?.nom ?? undefined,
          objet: OBJET_LABEL[d.objet] ?? d.objet,
          message: d.message,
          dateEvenement: formatDateFr(d.date_evenement),
          lieuEvenement: d.lieu_evenement ?? undefined,
          lienConversation: `${SITE_URL}/espace-pro/demandes?demande=${d.id}`,
        };
      }

      if (simulerEchec) { await liberer("échec simulé (test)"); continue; }

      const { data: sent, error: mailErr } = await admin.functions.invoke("send-app-email", {
        body: {
          templateName,
          recipientEmail,
          idempotencyKey: `demande-${kind}-${d.id}`,
          templateData,
        },
      });
      if (mailErr || (sent as { error?: string } | null)?.error) {
        await liberer(String(mailErr?.message ?? (sent as { error?: string }).error));
        continue;
      }
      resultats[id] = (sent as { reason?: string } | null)?.reason === "email_suppressed" ? "adresse_supprimee" : "envoye";
    } catch (e) {
      await liberer(e instanceof Error ? e.message : String(e));
    }
  }

  console.log("notify-nouveau-contact-presta", { kind, resultats });
  return json({ success: true, kind, resultats });
});
