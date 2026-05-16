// cron-suspend-charte-obsolete — Suspends active providers who haven't signed the new charter version within 15 days
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: active } = await adminClient.from("chartes_versions")
      .select("numero_version").is("archivee_le", null).maybeSingle();
    if (!active) throw new Error("Aucune charte active");

    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString();

    const { data: candidates, error } = await adminClient.from("prestataires")
      .select("id, charte_version_signee, notification_charte_obsolete_envoyee_le")
      .eq("statut", "actif")
      .not("notification_charte_obsolete_envoyee_le", "is", null)
      .lt("notification_charte_obsolete_envoyee_le", fifteenDaysAgo);
    if (error) throw error;

    const toSuspend = (candidates ?? []).filter(p =>
      p.charte_version_signee !== active.numero_version
    );

    let suspended = 0;
    for (const p of toSuspend) {
      const { error: upErr } = await adminClient.from("prestataires").update({
        statut: "suspendu",
        motif_suspension: "charte_obsolete",
      }).eq("id", p.id).select();
      if (!upErr) suspended++;
    }

    return new Response(JSON.stringify({ success: true, suspended, scanned: candidates?.length ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
