// cron-fin-exemption-charte — Suspend les fiches actives dont l'exemption de charte a expiré sans signature
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PUBLIC_SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://lesnoces.net";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);

    // Fiches visibles dont l'exemption est expirée sans charte signée
    const { data: candidates, error } = await admin
      .from("prestataires")
      .select("id, nom_commercial, email_contact, charte_exemptee_jusqua")
      .eq("statut", "actif")
      .is("charte_signee_le", null)
      .not("charte_exemptee_jusqua", "is", null)
      .lte("charte_exemptee_jusqua", nowIso);

    if (error) throw error;

    let suspended = 0;
    for (const p of candidates ?? []) {
      const { error: upErr } = await admin
        .from("prestataires")
        .update({ statut: "suspendu", motif_suspension: "charte_non_signee" })
        .eq("id", p.id)
        .eq("statut", "actif")
        .is("charte_signee_le", null)
        .select("id");
      if (upErr) {
        console.error("update failed", p.id, upErr.message);
        continue;
      }
      suspended++;

      if (p.email_contact) {
        try {
          await admin.functions.invoke("send-transactional-email", {
            body: {
              templateName: "suspension_charte_exemption_expiree",
              recipientEmail: p.email_contact,
              idempotencyKey: `fin-exemption-${p.id}-${today}`,
              templateData: {
                nom_commercial: p.nom_commercial ?? "",
                lien_signature: `${PUBLIC_SITE_URL}/signer-la-charte`,
              },
            },
          });
        } catch (e) {
          console.error("email failed", p.id, (e as Error).message);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, scanned: candidates?.length ?? 0, suspended }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
