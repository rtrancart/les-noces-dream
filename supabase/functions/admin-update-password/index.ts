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

    // Verify caller identity using JWT claims (doesn't require active session)
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) throw new Error("Non autorisé");
    const callerId = claimsData.claims.sub;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get caller roles
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const callerRolesList = (callerRoles ?? []).map((r: any) => r.role);
    const isAdmin = callerRolesList.includes("admin");
    const isSuperAdmin = callerRolesList.includes("super_admin");

    if (!isAdmin && !isSuperAdmin) {
      throw new Error("Accès refusé : rôle admin requis");
    }

    const { target_user_id, new_password } = await req.json();
    if (!target_user_id) throw new Error("target_user_id requis");
    if (!new_password || new_password.length < 6) {
      throw new Error("Le mot de passe doit contenir au moins 6 caractères");
    }

    // Get target user roles to enforce hierarchy
    const { data: targetRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", target_user_id);

    const targetRolesList = (targetRoles ?? []).map((r: any) => r.role);
    const targetIsAdmin = targetRolesList.includes("admin") || targetRolesList.includes("super_admin");

    // Security: only super_admin can change admin/super_admin passwords
    if (targetIsAdmin && !isSuperAdmin) {
      throw new Error("Accès refusé : seul un super admin peut modifier le mot de passe d'un administrateur");
    }

    // Update password
    const { error } = await adminClient.auth.admin.updateUserById(target_user_id, {
      password: new_password,
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
