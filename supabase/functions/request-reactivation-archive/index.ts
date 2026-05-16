// request-reactivation-archive — Archived prestataire requests reactivation; notifies admins
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
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) throw new Error("Non autorisé");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { message } = await req.json().catch(() => ({}));
    const cleanMessage = typeof message === "string" ? message.trim().slice(0, 1000) : null;

    const { data: presta } = await adminClient.from("prestataires")
      .select("id, nom_commercial, email_contact, statut").eq("user_id", user.id).maybeSingle();
    if (!presta) throw new Error("Aucune fiche trouvée");
    if (presta.statut !== "archive") throw new Error("Cette fiche n'est pas archivée");

    await adminClient.from("prestataires").update({
      demande_reactivation_le: new Date().toISOString(),
      demande_reactivation_message: cleanMessage,
    }).eq("id", presta.id);

    // Notify all admins/super_admins
    const { data: adminRoles } = await adminClient.from("user_roles")
      .select("user_id").in("role", ["admin", "super_admin"]);
    const adminIds = [...new Set((adminRoles ?? []).map((r: any) => r.user_id))];
    if (adminIds.length) {
      const { data: adminProfiles } = await adminClient.from("profiles")
        .select("email").in("id", adminIds);
      for (const a of adminProfiles ?? []) {
        if (!a.email) continue;
        await adminClient.functions.invoke("send-transactional-email", {
          body: {
            templateName: "demande_reactivation_admin",
            recipientEmail: a.email,
            idempotencyKey: `reactivation-${presta.id}-${Date.now()}`,
            templateData: {
              nom_commercial: presta.nom_commercial,
              email_prestataire: presta.email_contact,
              message: cleanMessage,
              lien_backoffice: `${siteUrl}/admin/prestataires/${presta.id}`,
            },
          },
        });
      }
    }

    return new Response(JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
