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

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) throw new Error("Non autorisé");
    const callerId = claimsData.claims.sub;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    const isAdmin = (callerRoles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) throw new Error("Accès refusé");

    // Get all prestataires without user_id that have an email
    const { data: orphans, error: fetchErr } = await adminClient
      .from("prestataires")
      .select("id, nom_commercial, email_contact")
      .is("user_id", null)
      .not("email_contact", "is", null);

    if (fetchErr) throw fetchErr;

    const results: any[] = [];

    for (const p of (orphans ?? [])) {
      if (!p.email_contact) continue;

      try {
        // Check if email already exists
        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const exists = existingUsers?.users?.some(
          (u: any) => u.email?.toLowerCase() === p.email_contact!.toLowerCase()
        );

        if (exists) {
          results.push({ id: p.id, nom: p.nom_commercial, status: "skipped", reason: "email already exists" });
          continue;
        }

        // Create user with random password
        const password = Math.random().toString(36).slice(-10) + "A1!";
        const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
          email: p.email_contact,
          password,
          email_confirm: true,
          user_metadata: { role_souhaite: "prestataire" },
        });

        if (createErr) {
          results.push({ id: p.id, nom: p.nom_commercial, status: "error", reason: createErr.message });
          continue;
        }

        const userId = newUser.user!.id;

        // Ensure role is prestataire
        await adminClient.from("user_roles").delete().eq("user_id", userId);
        await adminClient.from("user_roles").insert({ user_id: userId, role: "prestataire" });

        // Link to prestataire
        await adminClient.from("prestataires").update({ user_id: userId }).eq("id", p.id);

        results.push({ id: p.id, nom: p.nom_commercial, status: "created", user_id: userId });
      } catch (e: any) {
        results.push({ id: p.id, nom: p.nom_commercial, status: "error", reason: e.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, total: orphans?.length ?? 0, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
