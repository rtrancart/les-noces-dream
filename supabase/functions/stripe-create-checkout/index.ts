// Crée une session Stripe Checkout pour un prestataire.
// - Crée le Customer Stripe si nécessaire.
// - Configure trial_end = fin_essai_le (si futur) pour différer le 1er débit à la fin d'essai.
// - Retourne { url } vers Checkout.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

type Formule = "standard" | "premium" | "annuel";

const PRICE_BY_FORMULE: Record<Formule, string | undefined> = {
  standard: Deno.env.get("STRIPE_PRICE_STANDARD"),
  premium: Deno.env.get("STRIPE_PRICE_PREMIUM"),
  annuel: Deno.env.get("STRIPE_PRICE_ANNUEL"),
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
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
    const userEmail = (claimsData.claims.email as string | undefined) ?? undefined;

    const body = await req.json().catch(() => ({}));
    const formule = body?.formule as Formule | undefined;
    if (!formule || !(formule in PRICE_BY_FORMULE)) {
      return json({ error: "Formule invalide" }, 400);
    }
    const priceId = PRICE_BY_FORMULE[formule];
    if (!priceId) return json({ error: `Price ID manquant pour ${formule}` }, 500);

    // Service role pour lire/écrire abonnements et prestataires
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: prestataire, error: pErr } = await supabaseAdmin
      .from("prestataires")
      .select("id, nom_commercial, email_contact")
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr || !prestataire) return json({ error: "Prestataire introuvable" }, 404);

    const { data: abo } = await supabaseAdmin
      .from("abonnements")
      .select("id, stripe_customer_id, fin_essai_le")
      .eq("prestataire_id", prestataire.id)
      .maybeSingle();

    // 1. Customer Stripe — vérifier que l'ID stocké existe encore côté Stripe
    let customerId = abo?.stripe_customer_id ?? null;
    if (customerId) {
      try {
        const existing = await stripe.customers.retrieve(customerId);
        if ((existing as Stripe.DeletedCustomer).deleted) customerId = null;
      } catch (_e) {
        // Customer inconnu de Stripe (ex : ID de test/simulé) → on recrée
        customerId = null;
      }
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: prestataire.email_contact ?? userEmail,
        name: prestataire.nom_commercial ?? undefined,
        metadata: {
          prestataire_id: prestataire.id,
          user_id: userId,
        },
      });
      customerId = customer.id;

      if (abo?.id) {
        await supabaseAdmin
          .from("abonnements")
          .update({ stripe_customer_id: customerId })
          .eq("id", abo.id);
      }
      // Si aucune ligne abonnement n'existe encore, le webhook la créera à l'issue du checkout.
    }

    // 2. Si le customer a déjà une (ou plusieurs) subscription active/trialing/past_due,
    //    on fait un CHANGEMENT DE PLAN sur la principale et on annule les doublons.
    //    Cela évite qu'un prestataire se retrouve avec 2 abonnements facturés en parallèle
    //    quand il change de formule via notre UI.
    const existingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
    });
    const activeSubs = existingSubs.data.filter((s) =>
      ["active", "trialing", "past_due", "unpaid"].includes(s.status)
    );

    if (activeSubs.length > 0) {
      // La plus ancienne devient la "principale" ; les autres sont des doublons à annuler.
      activeSubs.sort((a, b) => a.created - b.created);
      const primary = activeSubs[0];
      const duplicates = activeSubs.slice(1);

      for (const dup of duplicates) {
        try {
          await stripe.subscriptions.cancel(dup.id, { prorate: true });
        } catch (e) {
          console.error("Failed to cancel duplicate subscription", dup.id, e);
        }
      }

      const currentItem = primary.items.data[0];
      const alreadyOnTargetPrice = currentItem?.price?.id === priceId;

      if (!alreadyOnTargetPrice) {
        await stripe.subscriptions.update(primary.id, {
          items: [{ id: currentItem.id, price: priceId }],
          proration_behavior: "create_prorations",
          cancel_at_period_end: false,
          metadata: {
            prestataire_id: prestataire.id,
            user_id: userId,
            formule,
          },
        });
      } else if (duplicates.length === 0) {
        return json({ changed: false, message: "Vous êtes déjà sur cette formule." });
      }

      return json({ changed: true });
    }

    // 3. Aucun abonnement actif → nouveau Checkout (1re souscription)
    const finEssai = abo?.fin_essai_le ? new Date(abo.fin_essai_le) : null;
    const nowSec = Math.floor(Date.now() / 1000);
    const trialEndSec = finEssai && finEssai.getTime() > Date.now()
      ? Math.floor(finEssai.getTime() / 1000)
      : null;

    const origin = req.headers.get("origin") ?? Deno.env.get("PUBLIC_SITE_URL") ?? "";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: "always",
      subscription_data: {
        ...(trialEndSec && trialEndSec > nowSec ? { trial_end: trialEndSec } : {}),
        metadata: {
          prestataire_id: prestataire.id,
          user_id: userId,
          formule,
        },
      },
      success_url: `${origin}/espace-pro/abonnement?statut=succes`,
      cancel_url: `${origin}/espace-pro/abonnement?statut=annule`,
      metadata: {
        prestataire_id: prestataire.id,
        formule,
      },
    });

    return json({ url: session.url });
  } catch (e) {
    console.error("stripe-create-checkout error", e);
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
