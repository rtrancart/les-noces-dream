import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Non autorisé");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    // Verify caller is admin/super_admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) throw new Error("Non autorisé");
    const callerId = claimsData.claims.sub;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);

    const callerRoleList = (callerRoles ?? []).map((r: any) => r.role);
    const isAdmin = callerRoleList.includes("admin") || callerRoleList.includes("super_admin");
    const isSuperAdmin = callerRoleList.includes("super_admin");

    if (!isAdmin) throw new Error("Accès refusé : rôle admin requis");

    const body = await req.json();
    const { email, password, prenom, nom, telephone, date_naissance, role, prestataire_id } = body;

    if (!email || !password || !role) {
      throw new Error("Email, mot de passe et rôle sont requis");
    }

    // Only super_admin can create admin/super_admin
    if ((role === "admin" || role === "super_admin") && !isSuperAdmin) {
      throw new Error("Seul un super admin peut créer un administrateur");
    }

    const allowedRoles = ["client", "prestataire", "admin", "super_admin"];
    if (!allowedRoles.includes(role)) {
      throw new Error("Rôle invalide : " + role);
    }

    // Check email uniqueness in auth.users
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(
      (u: any) => u.email?.toLowerCase() === email.trim().toLowerCase()
    );
    if (emailExists) {
      throw new Error("Un compte avec cet email existe déjà");
    }

    // Create auth user (auto-confirmed)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { prenom: prenom || null, nom: nom || null, role_souhaite: role },
    });

    if (createError) throw createError;
    if (!newUser?.user) throw new Error("Erreur lors de la création");

    const userId = newUser.user.id;

    // Update profile with additional fields (profile created by trigger)
    if (telephone || date_naissance) {
      await adminClient
        .from("profiles")
        .update({
          telephone: telephone || null,
          date_naissance: date_naissance || null,
        })
        .eq("id", userId);
    }

    // The trigger creates the default role from metadata, but we want a specific role
    // Delete default role and insert the requested one
    await adminClient.from("user_roles").delete().eq("user_id", userId);
    const { error: roleError } = await adminClient
      .from("user_roles")
      .insert({ user_id: userId, role });

    if (roleError) throw roleError;

    // If prestataire_id provided, link user to existing prestataire
    if (prestataire_id && role === "prestataire") {
      await adminClient
        .from("prestataires")
        .update({ user_id: userId })
        .eq("id", prestataire_id);
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
