// notify-nouvelle-soumission — Notifie les admins d'une nouvelle fiche prestataire soumise.
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

    const { prestataire_id } = await req.json();
    if (!prestataire_id) throw new Error("prestataire_id requis");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Ownership check
    const { data: presta } = await adminClient
      .from("prestataires")
      .select("id, nom_commercial, ville, user_id, categorie_mere_id, categories:categorie_mere_id(nom)")
      .eq("id", prestataire_id)
      .maybeSingle();
    if (!presta) throw new Error("Prestataire introuvable");
    if (presta.user_id !== caller.id) throw new Error("Non autorisé sur cette fiche");

    // Fetch admin emails
    const { data: adminRoles } = await adminClient
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "super_admin"]);
    const adminIds = (adminRoles ?? []).map((r: any) => r.user_id);
    const { data: adminProfiles } = await adminClient
      .from("profiles")
      .select("id, email")
      .in("id", adminIds);

    const lienBackOffice = `${siteUrl}/admin/prestataires`;
    const categorie = (presta as any).categories?.nom ?? "";

    // Send to each admin
    for (const ap of adminProfiles ?? []) {
      await adminClient.functions.invoke("send-transactional-email", {
        body: {
          templateName: "notif_nouvelle_soumission_fiche",
          recipientEmail: (ap as any).email,
          idempotencyKey: `submission-${prestataire_id}-${(ap as any).id}`,
          templateData: {
            nom_commercial: presta.nom_commercial,
            categorie,
            ville: presta.ville,
            lien_back_office: lienBackOffice,
          },
        },
      }).catch((e) => console.error("email send failed", e));
    }

    // In-app notif for admins
    for (const ap of adminProfiles ?? []) {
      await adminClient.from("notifications").insert({
        user_id: (ap as any).id,
        type: "info" as any,
        titre: "Nouvelle fiche à valider",
        corps: `${presta.nom_commercial} (${presta.ville}) a soumis sa fiche pour validation.`,
        lien: lienBackOffice,
      }).then(() => {}, () => {});
    }

    return new Response(JSON.stringify({ success: true, notified: adminProfiles?.length ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
