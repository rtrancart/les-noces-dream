import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.0.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2025-08-27.basil",
  httpClient: Stripe.createFetchHttpClient(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non autorisé" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return json({ error: "Non autorisé" }, 401);
    const callerId = claimsData.claims.sub;

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", callerId);
    const list = (roles ?? []).map((r: { role: string }) => r.role);
    if (!list.includes("admin") && !list.includes("super_admin")) {
      return json({ error: "Accès refusé : rôle admin requis" }, 403);
    }

    // Abonnements souscrits mais encore en période d'essai reportée.
    const { data: abos, error } = await admin
      .from("abonnements")
      .select("id, stripe_subscription_id")
      .eq("statut", "trialing")
      .not("stripe_subscription_id", "is", null);
    if (error) throw error;

    const resultats: Array<{ id: string; sub: string; ok: boolean; statut?: string; message?: string }> = [];
    for (const abo of abos ?? []) {
      const subId = abo.stripe_subscription_id as string;
      try {
        const sub = await stripe.subscriptions.update(subId, {
          trial_end: "now",
          proration_behavior: "none",
        });
        const item = sub.items.data[0];
        const periodEnd = (item?.current_period_end ?? null) as number | null;
        const statut = sub.status === "active" ? "actif"
          : sub.status === "trialing" ? "trialing"
          : sub.status === "past_due" || sub.status === "unpaid" ? "en_retard"
          : sub.status === "canceled" ? "resilie"
          : "actif";
        await admin
          .from("abonnements")
          .update({
            statut,
            fin_essai_le: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
            fin_periode_le: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          })
          .eq("id", abo.id);
        resultats.push({ id: abo.id, sub: subId, ok: true, statut });
      } catch (e) {
        resultats.push({
          id: abo.id,
          sub: subId,
          ok: false,
          message: e instanceof Error ? e.message : "Erreur inconnue",
        });
      }
    }


    return json({ traites: resultats.length, resultats });
  } catch (e) {
    console.error("admin-end-trials error", e);
    return json({ error: e instanceof Error ? e.message : "Erreur interne" }, 500);
  }
});
