// resend-magic-link — Admin resends magic link to a pre-registered prestataire
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signInvitationToken } from "../_shared/invitation-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Non autorisé");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "https://lesnoces.net";

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Non autorisé");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roles } = await adminClient.from("user_roles").select("role").eq("user_id", caller.id);
    const roleList = (roles ?? []).map((r: any) => r.role);
    if (!roleList.includes("admin") && !roleList.includes("super_admin")) {
      throw new Error("Accès refusé : rôle admin requis");
    }

    const { prestataire_id } = await req.json();
    if (!prestataire_id) throw new Error("prestataire_id requis");

    const { data: presta, error: pErr } = await adminClient.from("prestataires")
      .select("id, email_contact, nom_commercial, user_id, statut, relances_envoyees, premier_login_le")
      .eq("id", prestataire_id).maybeSingle();
    if (pErr) throw pErr;
    if (!presta) throw new Error("Prestataire introuvable");
    if (!presta.email_contact) throw new Error("Prestataire sans email");

    const { data: profile } = await adminClient.from("profiles").select("prenom").eq("id", presta.user_id).maybeSingle();

    // Custom signed token (immune to Gmail/Outlook link scanners)
    const { token: invitationToken, jti, expiresAt } = await signInvitationToken({
      userId: presta.user_id,
      prestataireId: presta.id,
    });
    const { error: tokenInsertErr } = await adminClient.from("invitation_tokens").insert({
      jti,
      user_id: presta.user_id,
      prestataire_id: presta.id,
      action: "accept_invitation",
      expires_at: expiresAt.toISOString(),
    });
    if (tokenInsertErr) throw tokenInsertErr;
    const magicLink = `${siteUrl}/accept-invitation?token=${invitationToken}`;

    // Compute remaining days before auto-archive
    let joursRestants: number | null = null;
    if (presta.premier_login_le) {
      const elapsed = (Date.now() - new Date(presta.premier_login_le).getTime()) / 86400000;
      joursRestants = Math.max(0, Math.ceil(60 - elapsed));
    }

    await adminClient.functions.invoke("send-transactional-email", {
      body: {
        templateName: "relance_signature_charte",
        recipientEmail: presta.email_contact,
        idempotencyKey: `relance-${presta.id}-${Date.now()}`,
        templateData: {
          prenom: profile?.prenom ?? null,
          nom_commercial: presta.nom_commercial,
          magic_link: linkData.properties.action_link,
          jours_restants: joursRestants,
        },
      },
    });

    await adminClient.from("prestataires").update({
      magic_link_envoye_le: new Date().toISOString(),
      relances_envoyees: (presta.relances_envoyees ?? 0) + 1,
    }).eq("id", presta.id);

    await adminClient.from("logs_admin").insert({
      admin_id: caller.id,
      action: "resend_magic_link",
      cible_type: "prestataire",
      cible_id: presta.id,
    }).then(() => {}, () => {});

    return new Response(JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
