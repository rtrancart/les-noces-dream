// notify-nouveau-contact-presta — Notifie un prestataire d'une nouvelle demande de devis.
// Deux variantes selon que l'auteur de la demande a un compte ou non.
// Aucune coordonnée du couple n'est exposée : la réponse se fait via la messagerie de la plateforme.
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

function formatDateFr(iso?: string | null): string | undefined {
  if (!iso) return undefined;
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://lesnoces.net";

  let demande_id: string | undefined;
  try {
    const body = await req.json();
    demande_id = typeof body?.demande_id === "string" ? body.demande_id.trim() : undefined;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!demande_id) return json({ error: "demande_id requis" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: demande, error: demErr } = await admin
    .from("demandes_devis")
    .select(`
      id, profile_id, contact_id, nom_contact, objet, message,
      date_evenement, lieu_evenement,
      prestataire:prestataires!demandes_devis_prestataire_id_fkey (
        id, nom_commercial, email_contact,
        categorie:categories!prestataires_categorie_mere_id_fkey ( nom )
      )
    `)
    .eq("id", demande_id)
    .maybeSingle();

  if (demErr || !demande || !demande.prestataire) {
    console.error("Demande introuvable", demErr);
    return json({ error: "Demande introuvable" }, 404);
  }

  const presta = demande.prestataire as {
    id: string; nom_commercial: string; email_contact: string;
    categorie: { nom: string } | null;
  };
  if (!presta.email_contact) return json({ error: "Prestataire sans email" }, 400);

  const clientPrenom = demande.nom_contact ? demande.nom_contact.split(" ")[0] : undefined;
  const templateName = demande.profile_id
    ? "notif_nouveau_contact_presta"
    : "notif_nouveau_contact_presta_sans_compte";

  const templateData = {
    prestataireNom: presta.nom_commercial,
    clientPrenom,
    categorie: presta.categorie?.nom ?? undefined,
    objet: OBJET_LABEL[demande.objet] ?? demande.objet,
    message: demande.message,
    dateEvenement: formatDateFr(demande.date_evenement),
    lieuEvenement: demande.lieu_evenement ?? undefined,
    lienConversation: `${SITE_URL}/pro/messages/${demande.id}`,
  };

  const { error: mailErr } = await admin.functions.invoke("send-transactional-email", {
    body: {
      templateName,
      recipientEmail: presta.email_contact,
      idempotencyKey: `nouveau-contact-${demande.id}`,
      templateData,
    },
  });

  if (mailErr) {
    console.error("send-transactional-email error", mailErr);
    return json({ error: "Envoi email impossible" }, 500);
  }

  return json({ success: true, template: templateName });
});
