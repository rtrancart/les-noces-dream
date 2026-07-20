// notify-charte-version-update — Notifies all active providers whose signed version differs from active
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    if (!roleList.includes("super_admin")) throw new Error("Accès refusé : rôle super_admin requis");

    const { data: active } = await adminClient.from("chartes_versions").select("numero_version").is("archivee_le", null).maybeSingle();
    if (!active) throw new Error("Aucune charte active");

    const { data: targets, error } = await adminClient.from("prestataires")
      .select("id, email_contact, user_id, nom_commercial, charte_version_signee")
      .eq("statut", "actif")
      .or(`charte_version_signee.is.null,charte_version_signee.neq.${active.numero_version}`);
    if (error) throw error;

    let sent = 0;
    const now = new Date().toISOString();
    for (const p of targets ?? []) {
      if (!p.email_contact) continue;
      const { data: profile } = await adminClient.from("profiles").select("prenom").eq("id", p.user_id).maybeSingle();
      await adminClient.functions.invoke("send-transactional-email", {
        body: {
          templateName: "notif_nouvelle_version_charte",
          recipientEmail: p.email_contact,
          idempotencyKey: `charte-update-${p.id}-${active.numero_version}`,
          templateData: {
            prenom: profile?.prenom ?? null,
            nom_commercial: p.nom_commercial,
            numero_version: active.numero_version,
            magic_link: `${siteUrl}/pro/charte`,
          },
        },
      });
      await adminClient.from("prestataires").update({ notification_charte_obsolete_envoyee_le: now }).eq("id", p.id);
      sent++;
    }

    return new Response(JSON.stringify({ success: true, notified: sent, total_targets: targets?.length ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
