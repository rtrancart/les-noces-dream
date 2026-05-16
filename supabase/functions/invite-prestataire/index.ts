// invite-prestataire — Admin invites a new prestataire via magic link
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

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

    const body = await req.json();
    const {
      email, prenom, nom, nom_commercial, telephone,
      categorie_mere_id, categorie_fille_id,
      ville, region, code_postal, notes_pre_inscription,
    } = body;

    if (!email || !nom_commercial || !categorie_mere_id || !ville || !region) {
      throw new Error("Champs requis manquants (email, nom_commercial, catégorie, ville, région)");
    }
    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Check or create auth user
    const { data: list } = await adminClient.auth.admin.listUsers();
    let userId = list?.users?.find((u: any) => u.email?.toLowerCase() === cleanEmail)?.id;
    if (!userId) {
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: cleanEmail,
        email_confirm: true,
        user_metadata: { prenom: prenom ?? null, nom: nom ?? null, role_souhaite: "prestataire" },
      });
      if (createError) throw createError;
      userId = newUser.user!.id;
    }
    // Ensure prestataire role
    await adminClient.from("user_roles").upsert({ user_id: userId, role: "prestataire" }, { onConflict: "user_id,role" });

    // 2. Create prestataire row (pre_inscrit)
    let slug = slugify(nom_commercial);
    let attempt = 0;
    while (attempt < 5) {
      const { data: existing } = await adminClient.from("prestataires").select("id").eq("slug", slug).maybeSingle();
      if (!existing) break;
      attempt++;
      slug = `${slugify(nom_commercial)}-${attempt + 1}`;
    }

    const { data: presta, error: prestaError } = await adminClient.from("prestataires").insert({
      user_id: userId,
      nom_commercial,
      slug,
      categorie_mere_id,
      categorie_fille_id: categorie_fille_id ?? null,
      ville,
      region,
      code_postal: code_postal ?? null,
      telephone: telephone ?? null,
      email_contact: cleanEmail,
      statut: "pre_inscrit",
      cree_par_admin: true,
      notes_pre_inscription: notes_pre_inscription ?? null,
      magic_link_envoye_le: new Date().toISOString(),
    }).select().single();
    if (prestaError) throw prestaError;

    // 3. Generate magic link (invite type)
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "invite",
      email: cleanEmail,
      options: { redirectTo: `${siteUrl}/accept-invitation` },
    });
    if (linkError) throw linkError;
    const magicLink = linkData.properties.action_link;

    // 4. Send email via send-transactional-email
    await adminClient.functions.invoke("send-transactional-email", {
      body: {
        templateName: "invitation_prestataire",
        recipientEmail: cleanEmail,
        idempotencyKey: `invite-${presta.id}`,
        templateData: { prenom: prenom ?? null, nom_commercial, magic_link: magicLink, expiration_heures: 24 },
      },
    });

    // 5. Admin log
    await adminClient.from("logs_admin").insert({
      admin_id: caller.id,
      action: "invite_prestataire",
      cible_type: "prestataire",
      cible_id: presta.id,
      details: { email: cleanEmail, nom_commercial },
    }).then(() => {}, () => {});

    return new Response(JSON.stringify({ success: true, prestataire_id: presta.id, user_id: userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
