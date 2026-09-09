// Crée une session Stripe Customer Portal pour un prestataire.
// Permet à l'utilisateur de mettre à jour son moyen de paiement, consulter ses factures
// et résilier son abonnement (en fin de période, configuré côté dashboard Stripe).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";
import { stripeSecretKey } from "../_shared/stripe-config.ts";

const stripe = new Stripe(stripeSecretKey(), {
  apiVersion: "2024-11-20.acacia",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

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

    const { data: prestataire, error: pErr } = await supabaseAdmin
      .from("prestataires")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr || !prestataire) return json({ error: "Prestataire introuvable" }, 404);

    const { data: abo } = await supabaseAdmin
      .from("abonnements")
      .select("stripe_customer_id")
      .eq("prestataire_id", prestataire.id)
      .maybeSingle();

    if (!abo?.stripe_customer_id) {
      return json({ error: "Aucun compte Stripe rattaché à cet abonnement" }, 404);
    }

    const origin = req.headers.get("origin") ?? Deno.env.get("PUBLIC_SITE_URL") ?? "";
    const returnUrl = `${origin}/espace-pro/abonnement`;

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: abo.stripe_customer_id,
        return_url: returnUrl,
      });
      return json({ url: session.url });
    } catch (e) {
      // Customer supprimé côté Stripe → 404 propre (l'UI proposera une nouvelle souscription)
      const code = (e as { code?: string })?.code;
      if (code === "resource_missing") {
        return json({ error: "Le compte Stripe rattaché est introuvable. Veuillez souscrire à nouveau." }, 404);
      }
      throw e;
    }
  } catch (e) {
    console.error("stripe-create-portal-session error", e);
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
