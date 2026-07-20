// request-reactivation-archive — Prestataire archivé (charte non signée dans les 60 jours)
// demande la réactivation et la republication de sa fiche.
//
// Auth optionnelle :
//   - Si Authorization header fourni : on résout prestataire_id via user_id.
//   - Sinon : prestataire_id doit être passé dans le body (provenance : magic link
//     expiré, redirection 423 archive_locked depuis sign-charte, ou CTA email).
//
// Codes retour :
//   200 : demande envoyée
//   400 : payload invalide / prestataire_id manquant
//   404 : prestataire introuvable
//   409 : demande déjà enregistrée aujourd'hui (anti-spam)
//   422 : conditions non remplies (statut != archive ou motif != charte_non_signee)
//   500 : erreur interne
//
// Variables d'environnement requises :
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto)
//   - REACTIVATION_TEAM_EMAIL : destinataire interne (équipe LesNoces.net)
//   - PUBLIC_SITE_URL (optionnel)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "https://lesnoces.net";
    const teamEmail = Deno.env.get("REACTIVATION_TEAM_EMAIL");

    if (!teamEmail) {
      console.error("REACTIVATION_TEAM_EMAIL non configuré");
      return json(500, { error: "Configuration serveur incomplète" });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));
    const bodyPid: string | undefined = typeof body?.prestataire_id === "string" ? body.prestataire_id : undefined;

    // Résoudre prestataire_id : priorité au user authentifié, sinon body
    let prestataireId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await callerClient.auth.getUser();
      if (user) {
        const { data: p } = await adminClient
          .from("prestataires")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (p) prestataireId = p.id;
      }
    }
    if (!prestataireId && bodyPid) {
      if (!UUID_RE.test(bodyPid)) return json(400, { error: "prestataire_id invalide" });
      prestataireId = bodyPid;
    }
    if (!prestataireId) return json(400, { error: "prestataire_id manquant" });

    // Vérification des conditions
    const { data: presta, error: prestaErr } = await adminClient
      .from("prestataires")
      .select("id, nom_commercial, email_contact, statut, motif_suspension, demande_reactivation_le")
      .eq("id", prestataireId)
      .maybeSingle();

    if (prestaErr) {
      console.error("Erreur lecture prestataire", prestaErr);
      return json(500, { error: "Erreur serveur" });
    }
    if (!presta) return json(404, { error: "Prestataire introuvable" });

    if (presta.statut !== "archive" || presta.motif_suspension !== "charte_non_signee") {
      return json(422, { error: "Cette fiche n'est pas éligible à la réactivation" });
    }

    // Anti-spam : une demande max par jour
    if (presta.demande_reactivation_le) {
      const last = new Date(presta.demande_reactivation_le);
      const today = new Date();
      const sameDay =
        last.getUTCFullYear() === today.getUTCFullYear() &&
        last.getUTCMonth() === today.getUTCMonth() &&
        last.getUTCDate() === today.getUTCDate();
      if (sameDay) {
        return json(409, { error: "Une demande a déjà été enregistrée aujourd'hui" });
      }
    }

    // Mise à jour de la date de demande
    const { error: updErr } = await adminClient
      .from("prestataires")
      .update({ demande_reactivation_le: new Date().toISOString() })
      .eq("id", presta.id)
      .select("id")
      .maybeSingle();
    if (updErr) {
      console.error("Erreur update prestataire", updErr);
      return json(500, { error: "Erreur serveur" });
    }

    // Envoi email équipe (template Scaleway)
    const { error: emailErr } = await adminClient.functions.invoke("send-transactional-email", {
      body: {
        templateName: "demande_reactivation",
        recipientEmail: teamEmail,
        idempotencyKey: `reactivation-team-${presta.id}-${new Date().toISOString().slice(0, 10)}`,
        templateData: {
          nom_commercial: presta.nom_commercial,
          email_prestataire: presta.email_contact,
          prestataire_id: presta.id,
          lien_backoffice: `${siteUrl}/admin/prestataires?focus=${presta.id}`,
        },
      },
    });
    if (emailErr) console.error("Erreur envoi email équipe", emailErr);

    return json(200, { success: true });
  } catch (e: any) {
    console.error("request-reactivation-archive erreur", e);
    return json(500, { error: e?.message ?? "Erreur serveur" });
  }
});
