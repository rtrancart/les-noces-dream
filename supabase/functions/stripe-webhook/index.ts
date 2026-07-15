// Webhook Stripe : met à jour public.abonnements et public.prestataires.
// Vérifie la signature Stripe (STRIPE_WEBHOOK_SECRET). verify_jwt = false.
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-11-20.acacia",
});
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type Formule = "standard" | "premium" | "annuel";
const PLAN_BY_FORMULE: Record<Formule, string> = {
  standard: "standard_mensuel",
  premium: "premium_mensuel",
  annuel: "annuel",
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const sig = req.headers.get("stripe-signature");
  if (!sig || !WEBHOOK_SECRET) {
    return new Response("Missing signature or secret", { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error("Invalid Stripe signature", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;
        const subId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        await syncSubscription(sub);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(sub);
        break;
      }

      case "payment_method.attached": {
        const pm = event.data.object as Stripe.PaymentMethod;
        const customerId = typeof pm.customer === "string" ? pm.customer : pm.customer?.id;
        if (!customerId) break;
        await updateCardByCustomer(customerId, pm);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === "string" ? invoice.subscription : null;
        if (!subId) break;
        const sub = await stripe.subscriptions.retrieve(subId);
        const prestataireId = await resolvePrestataireId(sub);
        if (!prestataireId) break;

        const cardPatch = await resolveCardPatchFromSubscription(sub);

        await supabase
          .from("abonnements")
          .update({
            statut: "actif",
            fin_periode_le: new Date(sub.current_period_end * 1000).toISOString(),
            derniere_facture_id: invoice.id,
            nb_echecs_paiement: 0,
            premier_echec_le: null,
            rappel_impaye_envoye_le: null,
            suspendu_pour_impaye_le: null,
            ...cardPatch,
          })
          .eq("prestataire_id", prestataireId);

        // Réactivation auto si suspendu pour impayé
        await supabase.rpc("reactiver_prestataire_paiement", {
          p_prestataire_id: prestataireId,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === "string" ? invoice.subscription : null;
        if (!subId) break;
        const sub = await stripe.subscriptions.retrieve(subId);
        const prestataireId = await resolvePrestataireId(sub);
        if (!prestataireId) break;

        // Lire l'état courant pour piloter la déduplication des emails (jalons).
        const { data: cur } = await supabase
          .from("abonnements")
          .select("nb_echecs_paiement, premier_echec_le, rappel_impaye_envoye_le")
          .eq("prestataire_id", prestataireId)
          .maybeSingle();

        const nbAvant = cur?.nb_echecs_paiement ?? 0;
        const nbApres = nbAvant + 1;
        const premierEchecLe = cur?.premier_echec_le ?? null;
        const rappelDejaEnvoye = !!cur?.rappel_impaye_envoye_le;

        const patch: Record<string, unknown> = {
          statut: "en_retard",
          nb_echecs_paiement: nbApres,
        };

        // Jalon 1 : tout premier échec du cycle d'impayé
        let sendJalon1 = false;
        // Jalon 2 : rappel intermédiaire une seule fois, après ~7 jours
        let sendJalon2 = false;

        if (nbAvant === 0) {
          patch.premier_echec_le = new Date().toISOString();
          sendJalon1 = true;
        } else if (
          !rappelDejaEnvoye &&
          premierEchecLe &&
          Date.now() - new Date(premierEchecLe).getTime() >= 7 * 24 * 3600 * 1000
        ) {
          patch.rappel_impaye_envoye_le = new Date().toISOString();
          sendJalon2 = true;
        }

        await supabase
          .from("abonnements")
          .update(patch)
          .eq("prestataire_id", prestataireId);

        if (sendJalon1) {
          await enqueueImpayeEmail(prestataireId, "impaye_premier_echec", {
            idempotencyKey: `impaye-premier-${prestataireId}-${invoice.id}`,
          });
        } else if (sendJalon2) {
          await enqueueImpayeEmail(prestataireId, "impaye_rappel_intermediaire", {
            idempotencyKey: `impaye-rappel-${prestataireId}-${sub.id}-${premierEchecLe}`,
          });
        }
        // Tentatives intermédiaires entre les jalons : silencieuses.
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const prestataireId = await resolvePrestataireId(sub);
        if (!prestataireId) break;

        const failedForPayment =
          sub.cancellation_details?.reason === "payment_failed" ||
          sub.status === "unpaid" ||
          sub.status === "past_due";

        if (failedForPayment) {
          await supabase
            .from("abonnements")
            .update({
              statut: "annule",
              suspendu_pour_impaye_le: new Date().toISOString(),
              resilie_le: new Date().toISOString(),
            })
            .eq("prestataire_id", prestataireId);

          await supabase
            .from("prestataires")
            .update({
              statut: "suspendu",
              motif_suspension: "Abonnement définitivement abandonné pour impayé",
            })
            .eq("id", prestataireId);

          // Jalon 3 : email de suspension définitive
          await enqueueImpayeEmail(prestataireId, "impaye_suspension", {
            idempotencyKey: `impaye-suspension-${prestataireId}-${sub.id}`,
          });
        } else {
          await supabase
            .from("abonnements")
            .update({
              statut: "expire",
              cancel_at_period_end: false,
            })
            .eq("prestataire_id", prestataireId);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stripe-webhook handler error", e);
    return new Response("Handler error", { status: 500 });
  }
});

// -- Helpers ----------------------------------------------------------------

async function resolvePrestataireId(sub: Stripe.Subscription): Promise<string | null> {
  const fromMeta = sub.metadata?.prestataire_id;
  if (fromMeta) return fromMeta;

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const { data } = await supabase
    .from("abonnements")
    .select("prestataire_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.prestataire_id ?? null;
}

/**
 * Résout la carte (brand/last4) associée à un abonnement en tentant, dans l'ordre :
 * 1. sub.default_payment_method
 * 2. sub.latest_invoice.payment_intent.payment_method
 * 3. customer.invoice_settings.default_payment_method
 * Retourne un patch partiel — vide si rien de fiable trouvé (on ne veut jamais écraser une carte déjà connue avec null).
 */
async function resolveCardPatchFromSubscription(
  sub: Stripe.Subscription,
): Promise<Record<string, string>> {
  const pmId = await resolvePaymentMethodIdFromSubscription(sub);
  if (!pmId) return {};
  try {
    const pm = await stripe.paymentMethods.retrieve(pmId);
    return cardPatchFromPaymentMethod(pm);
  } catch (e) {
    console.warn("resolveCardPatchFromSubscription: retrieve pm failed", e);
    return {};
  }
}

async function resolvePaymentMethodIdFromSubscription(
  sub: Stripe.Subscription,
): Promise<string | null> {
  if (sub.default_payment_method) {
    return typeof sub.default_payment_method === "string"
      ? sub.default_payment_method
      : sub.default_payment_method.id;
  }
  // Tenter via customer
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer && !("deleted" in customer)) {
      const dpm = customer.invoice_settings?.default_payment_method;
      if (dpm) return typeof dpm === "string" ? dpm : dpm.id;
    }
  } catch (e) {
    console.warn("resolvePaymentMethodIdFromSubscription: retrieve customer failed", e);
  }
  return null;
}

function cardPatchFromPaymentMethod(pm: Stripe.PaymentMethod): Record<string, string> {
  const patch: Record<string, string> = { stripe_payment_method_id: pm.id };
  if (pm.card) {
    if (pm.card.brand) patch.carte_brand = pm.card.brand;
    if (pm.card.last4) patch.carte_last4 = pm.card.last4;
  }
  return patch;
}

async function updateCardByCustomer(customerId: string, pm: Stripe.PaymentMethod) {
  const patch = cardPatchFromPaymentMethod(pm);
  if (Object.keys(patch).length === 0) return;
  await supabase
    .from("abonnements")
    .update(patch)
    .eq("stripe_customer_id", customerId);
}

async function syncSubscription(sub: Stripe.Subscription) {
  const prestataireId = await resolvePrestataireId(sub);
  if (!prestataireId) return;

  const formule = (sub.metadata?.formule as Formule | undefined);
  const plan = formule ? PLAN_BY_FORMULE[formule] : null;
  const item = sub.items.data[0];
  const montantCents = item?.price?.unit_amount ?? null;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Statut interne à partir du statut Stripe + cancel_at_period_end
  let statut: string = "actif";
  if (sub.cancel_at_period_end) statut = "resilie";
  else if (sub.status === "trialing") statut = "trialing";
  else if (sub.status === "active") statut = "actif";
  else if (sub.status === "past_due") statut = "en_retard";
  else if (sub.status === "unpaid") statut = "en_retard";
  else if (sub.status === "canceled") statut = "expire";
  else if (sub.status === "paused") statut = "en_pause";

  const patch: Record<string, unknown> = {
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    statut,
    cancel_at_period_end: sub.cancel_at_period_end,
    fin_periode_le: new Date(sub.current_period_end * 1000).toISOString(),
    debut_le: new Date(sub.start_date * 1000).toISOString(),
    fin_essai_le: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
  };
  if (plan) patch.plan = plan;
  if (montantCents != null) patch.montant_cents = montantCents;
  if (sub.cancel_at_period_end && !("resilie_le" in patch)) {
    patch.resilie_le = new Date().toISOString();
  }

  // Enrichissement carte — on n'ajoute que si trouvé, jamais d'écrasement par null
  const cardPatch = await resolveCardPatchFromSubscription(sub);
  Object.assign(patch, cardPatch);

  const { data: existing } = await supabase
    .from("abonnements")
    .select("id")
    .eq("prestataire_id", prestataireId)
    .maybeSingle();

  if (existing?.id) {
    await supabase.from("abonnements").update(patch).eq("id", existing.id);
  } else {
    await supabase.from("abonnements").insert({
      prestataire_id: prestataireId,
      plan: plan ?? "mensuel",
      ...patch,
    });
  }
}
