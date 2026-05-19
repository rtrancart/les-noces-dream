// cron-archive-unsigned-prestataires — Archives pre_inscrit not signed > 60d after first login
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

    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    const { data: candidates, error } = await adminClient.from("prestataires")
      .select("id, nom_commercial, archivage_reporte_a")
      .in("statut", ["pre_inscrit", "a_completer"])
      .is("charte_signee_le", null)
      .not("premier_login_le", "is", null)
      .lt("premier_login_le", sixtyDaysAgo);
    if (error) throw error;

    const toArchive = (candidates ?? []).filter(p =>
      p.archivage_reporte_a === null || p.archivage_reporte_a < nowIso
    );

    let archived = 0;
    for (const p of toArchive) {
      const { error: upErr } = await adminClient.from("prestataires").update({
        statut: "archive",
        motif_suspension: "charte_non_signee",
      }).eq("id", p.id).select();
      if (!upErr) archived++;
    }

    return new Response(JSON.stringify({ success: true, archived, scanned: candidates?.length ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
