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

    // Verify caller
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Non autorisé");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const callerRoleList = (callerRoles ?? []).map((r: any) => r.role);
    const isAdmin = callerRoleList.includes("admin") || callerRoleList.includes("super_admin");
    const isSuperAdmin = callerRoleList.includes("super_admin");

    if (!isAdmin) throw new Error("Accès refusé : rôle admin requis");

    const { target_user_id } = await req.json();
    if (!target_user_id) throw new Error("target_user_id requis");
    if (target_user_id === caller.id) throw new Error("Vous ne pouvez pas supprimer votre propre compte");

    // Check target user roles
    const { data: targetRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", target_user_id);

    const targetRoleList = (targetRoles ?? []).map((r: any) => r.role);
    const targetIsAdmin = targetRoleList.includes("admin") || targetRoleList.includes("super_admin");

    // Only super_admin can delete admins
    if (targetIsAdmin && !isSuperAdmin) {
      throw new Error("Seul un super admin peut supprimer un administrateur");
    }

    // Delete user roles, profile, then auth user
    await adminClient.from("user_roles").delete().eq("user_id", target_user_id);
    await adminClient.from("profiles").delete().eq("id", target_user_id);
    
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(target_user_id);
    if (deleteError) throw deleteError;

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
