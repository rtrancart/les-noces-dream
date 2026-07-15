// Annule un changement de formule programmé (subscription schedule Stripe) et
// nettoie les colonnes plan_pending* de l'abonnement.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-11-20.acacia",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabaseAuth.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: prestataire } = await supabaseAdmin
      .from("prestataires")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!prestataire) return json({ error: "Prestataire introuvable" }, 404);

    const { data: abo } = await supabaseAdmin
      .from("abonnements")
      .select("id, stripe_schedule_id")
      .eq("prestataire_id", prestataire.id)
      .maybeSingle();

    if (!abo?.stripe_schedule_id) {
      return json({ error: "Aucun changement programmé à annuler" }, 404);
    }

    try {
      // release = détache le schedule sans reprogrammer, la sub continue telle quelle
      await stripe.subscriptionSchedules.release(abo.stripe_schedule_id);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      // Schedule inconnu / déjà libéré → on nettoie localement quand même
      if (code !== "resource_missing") {
        console.warn("release schedule failed", e);
      }
    }

    await supabaseAdmin
      .from("abonnements")
      .update({
        plan_pending: null,
        plan_pending_le: null,
        stripe_schedule_id: null,
      })
      .eq("id", abo.id);

    return json({ ok: true });
  } catch (e) {
    console.error("stripe-cancel-scheduled-change error", e);
    const message = e instanceof Error ? e.message : "Erreur interne";
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
