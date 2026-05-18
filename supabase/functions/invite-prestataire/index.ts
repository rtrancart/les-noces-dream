// invite-prestataire — Admin invites a prestataire via magic link.
// Accepts a NEW prestataire OR an existing one in `brouillon` to flip → `pre_inscrit`.
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
      prestataire_id,
      email, prenom, nom, nom_commercial, telephone,
      categorie_mere_id, categorie_fille_id,
      ville, region, code_postal,
      description, description_courte,
      notes_pre_inscription,
    } = body;

    if (!email || !nom_commercial || !categorie_mere_id || !ville || !region) {
      throw new Error("Champs requis manquants (email, nom_commercial, catégorie, ville, région)");
    }
    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Auth user (create or reuse) — paginate listUsers since there's no email filter
    let userId: string | undefined;
    const perPage = 1000;
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data: list, error: listErr } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (listErr) throw listErr;
      userId = list?.users?.find((u: any) => u.email?.toLowerCase() === cleanEmail)?.id;
      if (!list?.users || list.users.length < perPage) break;
    }
    if (!userId) {
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: cleanEmail,
        email_confirm: true,
        user_metadata: { prenom: prenom ?? null, nom: nom ?? null, role_souhaite: "prestataire" },
      });
      if (createError) {
        // Race / already exists — retry lookup across all pages
        if (/already|exist|registered/i.test(createError.message)) {
          for (let page = 1; page <= 20 && !userId; page++) {
            const { data: list } = await adminClient.auth.admin.listUsers({ page, perPage });
            userId = list?.users?.find((u: any) => u.email?.toLowerCase() === cleanEmail)?.id;
            if (!list?.users || list.users.length < perPage) break;
          }
          if (!userId) throw createError;
        } else {
          throw createError;
        }
      } else {
        userId = newUser.user!.id;
      }
    }
    await adminClient.from("user_roles").upsert({ user_id: userId, role: "prestataire" }, { onConflict: "user_id,role" });

    // Update profile prenom/nom if provided
    if (prenom || nom) {
      await adminClient.from("profiles").update({
        prenom: prenom ?? null,
        nom: nom ?? null,
      }).eq("id", userId);
    }

    // 2. Resolve prestataire row: update existing or create new
    let presta: any = null;
    if (prestataire_id) {
      const { data: updated, error: updErr } = await adminClient.from("prestataires").update({
        user_id: userId,
        nom_commercial, categorie_mere_id,
        categorie_fille_id: categorie_fille_id ?? null,
        ville, region,
        code_postal: code_postal ?? null,
        telephone: telephone ?? null,
        email_contact: cleanEmail,
        description: description ?? null,
        description_courte: description_courte ?? null,
        notes_pre_inscription: notes_pre_inscription ?? null,
        statut: "pre_inscrit",
        magic_link_envoye_le: new Date().toISOString(),
      }).eq("id", prestataire_id).select().single();
      if (updErr) throw updErr;
      presta = updated;
    } else {
      let slug = slugify(nom_commercial);
      let attempt = 0;
      while (attempt < 5) {
        const { data: existing } = await adminClient.from("prestataires").select("id").eq("slug", slug).maybeSingle();
        if (!existing) break;
        attempt++;
        slug = `${slugify(nom_commercial)}-${attempt + 1}`;
      }

      const { data: created, error: prestaError } = await adminClient.from("prestataires").insert({
        user_id: userId,
        nom_commercial, slug, categorie_mere_id,
        categorie_fille_id: categorie_fille_id ?? null,
        ville, region,
        code_postal: code_postal ?? null,
        telephone: telephone ?? null,
        email_contact: cleanEmail,
        description: description ?? null,
        description_courte: description_courte ?? null,
        statut: "pre_inscrit",
        cree_par_admin: true,
        notes_pre_inscription: notes_pre_inscription ?? null,
        magic_link_envoye_le: new Date().toISOString(),
      }).select().single();
      if (prestaError) throw prestaError;
      presta = created;
    }

    // 3. Magic link
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "invite",
      email: cleanEmail,
      options: { redirectTo: `${siteUrl}/accept-invitation` },
    });
    if (linkError) throw linkError;
    const magicLink = linkData.properties.action_link;

    // 4. Email
    await adminClient.functions.invoke("send-transactional-email", {
      body: {
        templateName: "invitation_prestataire",
        recipientEmail: cleanEmail,
        idempotencyKey: `invite-${presta.id}-${Date.now()}`,
        templateData: { prenom: prenom ?? null, nom_commercial, magic_link: magicLink, expiration_heures: 24 },
      },
    });

    // 5. Admin log (correct columns: entite/entite_id)
    await adminClient.from("logs_admin").insert({
      admin_id: caller.id,
      action: "invitation_envoyee",
      entite: "prestataires",
      entite_id: presta.id,
      details: { email: cleanEmail, nom_commercial },
    });

    return new Response(JSON.stringify({ success: true, prestataire_id: presta.id, user_id: userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
