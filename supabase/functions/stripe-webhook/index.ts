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
        // Ne pas laisser une sub obsolète écraser l'état de la sub courante
        // (cas d'un changement de plan qui a annulé un doublon).
        if (!(await isCurrentOrClaimableSubscription(sub))) break;
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

      case "payment_method.detached": {
        // Stripe ne renseigne pas customer sur detached, mais on peut effacer par pm id.
        const pm = event.data.object as Stripe.PaymentMethod;
        await supabase
          .from("abonnements")
          .update({
            stripe_payment_method_id: null,
            carte_brand: null,
            carte_last4: null,
          })
          .eq("stripe_payment_method_id", pm.id);
        break;
      }

      case "customer.updated": {
        // Détecte un changement de default_payment_method (via portail) et
        // synchronise la carte affichée côté fiche.
        const customer = event.data.object as Stripe.Customer;
        const dpm = customer.invoice_settings?.default_payment_method;
        if (!dpm) break;
        const pmId = typeof dpm === "string" ? dpm : dpm.id;
        try {
          const pm = await stripe.paymentMethods.retrieve(pmId);
          await updateCardByCustomer(customer.id, pm);
        } catch (e) {
          console.warn("customer.updated: retrieve pm failed", e);
        }
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

        // Garde D7 : ignorer si la sub est déjà morte / suspendue pour impayé /
        // résiliée-expirée. Les jalons ne doivent pas être rejoués sur un cycle clos.
        const { data: cur } = await supabase
          .from("abonnements")
          .select("nb_echecs_paiement, premier_echec_le, suspendu_pour_impaye_le, statut")
          .eq("prestataire_id", prestataireId)
          .maybeSingle();

        if (cur?.suspendu_pour_impaye_le) break;
        if (cur?.statut && ["annule", "expire"].includes(cur.statut)) break;

        const nbAvant = cur?.nb_echecs_paiement ?? 0;
        const nbApres = nbAvant + 1;

        const patch: Record<string, unknown> = {
          statut: "en_retard",
          nb_echecs_paiement: nbApres,
        };

        // Jalon 1 : tout premier échec du cycle d'impayé.
        // Jalon 2 : géré par le cron cron-relance-impaye-j7 (déterministe à J+7),
        // le webhook ne l'envoie plus.
        let sendJalon1 = false;
        if (nbAvant === 0) {
          patch.premier_echec_le = new Date().toISOString();
          sendJalon1 = true;
        }

        await supabase
          .from("abonnements")
          .update(patch)
          .eq("prestataire_id", prestataireId);

        if (sendJalon1) {
          await enqueueImpayeEmail(prestataireId, "impaye_premier_echec", {
            idempotencyKey: `impaye-premier-${prestataireId}-${invoice.id}`,
          });
        }
        // Tentatives intermédiaires entre les jalons : silencieuses.
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const prestataireId = await resolvePrestataireId(sub);
        if (!prestataireId) break;

        // Ignorer la suppression d'une sub qui n'est pas la sub courante :
        // c'est un doublon annulé lors d'un changement de plan, il ne doit
        // pas écraser l'état de la sub active.
        const { data: curAbo } = await supabase
          .from("abonnements")
          .select("stripe_subscription_id")
          .eq("prestataire_id", prestataireId)
          .maybeSingle();
        if (curAbo?.stripe_subscription_id && curAbo.stripe_subscription_id !== sub.id) {
          break;
        }

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
              plan_pending: null,
              plan_pending_le: null,
              stripe_schedule_id: null,
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
          // Résiliation volontaire arrivée à terme
          await supabase
            .from("abonnements")
            .update({
              statut: "expire",
              cancel_at_period_end: false,
              plan_pending: null,
              plan_pending_le: null,
              stripe_schedule_id: null,
            })
            .eq("prestataire_id", prestataireId);

          await supabase
            .from("prestataires")
            .update({
              statut: "resilie_expire",
              motif_suspension: "Abonnement résilié — fin de période atteinte",
            })
            .eq("id", prestataireId);
        }
        break;
      }

      case "subscription_schedule.updated":
      case "subscription_schedule.released":
      case "subscription_schedule.canceled": {
        const schedule = event.data.object as Stripe.SubscriptionSchedule;
        // Retrouver l'abonnement lié à ce schedule
        const { data: abo } = await supabase
          .from("abonnements")
          .select("id")
          .eq("stripe_schedule_id", schedule.id)
          .maybeSingle();
        if (!abo) break;

        if (event.type !== "subscription_schedule.updated") {
          // released / canceled → la bascule a eu lieu ou a été annulée, on nettoie
          await supabase
            .from("abonnements")
            .update({
              plan_pending: null,
              plan_pending_le: null,
              stripe_schedule_id: null,
            })
            .eq("id", abo.id);
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

async function isCurrentOrClaimableSubscription(sub: Stripe.Subscription): Promise<boolean> {
  const prestataireId = await resolvePrestataireId(sub);
  if (!prestataireId) return true;

  const { data: cur } = await supabase
    .from("abonnements")
    .select("stripe_subscription_id")
    .eq("prestataire_id", prestataireId)
    .maybeSingle();
  const currentId = cur?.stripe_subscription_id ?? null;
  if (!currentId || currentId === sub.id) return true;

  const incomingLive = ["active", "trialing", "past_due"].includes(sub.status);
  if (!incomingLive) return false;

  try {
    const existing = await stripe.subscriptions.retrieve(currentId);
    const existingLive = ["active", "trialing", "past_due"].includes(existing.status);
    return !existingLive;
  } catch (_e) {
    return true;
  }
}

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
  const planFromMeta = formule ? PLAN_BY_FORMULE[formule] : null;
  const item = sub.items.data[0];
  const montantCents = item?.price?.unit_amount ?? null;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Plan actuel dérivé du price si les metadata ne l'indiquent pas
  const currentPriceId = item?.price?.id ?? null;
  const planFromPrice = planFromPriceId(currentPriceId);
  const plan = planFromMeta ?? planFromPrice;

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
  if (sub.cancel_at_period_end) {
    patch.resilie_le = new Date().toISOString();
  } else {
    // Fix : réactivation → nettoyage explicite du champ resilie_le
    patch.resilie_le = null;
  }

  const cardPatch = await resolveCardPatchFromSubscription(sub);
  Object.assign(patch, cardPatch);

  const { data: existing } = await supabase
    .from("abonnements")
    .select("id, plan_pending")
    .eq("prestataire_id", prestataireId)
    .maybeSingle();

  // Nettoyage de plan_pending si la bascule vient d'avoir lieu
  if (existing?.plan_pending && plan && existing.plan_pending === plan) {
    patch.plan_pending = null;
    patch.plan_pending_le = null;
    patch.stripe_schedule_id = null;
  }

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

function planFromPriceId(priceId: string | null): string | null {
  if (!priceId) return null;
  if (priceId === Deno.env.get("STRIPE_PRICE_STANDARD")) return "standard_mensuel";
  if (priceId === Deno.env.get("STRIPE_PRICE_PREMIUM")) return "premium_mensuel";
  if (priceId === Deno.env.get("STRIPE_PRICE_ANNUEL")) return "annuel";
  return null;
}

// -- Emails d'impayé --------------------------------------------------------

const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://les-noces.lovable.app";

async function enqueueImpayeEmail(
  prestataireId: string,
  templateName: "impaye_premier_echec" | "impaye_rappel_intermediaire" | "impaye_suspension",
  opts: { idempotencyKey: string },
) {
  try {
    const { data: presta } = await supabase
      .from("prestataires")
      .select("email_contact, nom_commercial, user_id")
      .eq("id", prestataireId)
      .maybeSingle();

    if (!presta?.email_contact) {
      console.warn("enqueueImpayeEmail: no email_contact for prestataire", prestataireId);
      return;
    }

    let prenom: string | undefined;
    if (presta.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("prenom")
        .eq("id", presta.user_id)
        .maybeSingle();
      prenom = profile?.prenom ?? undefined;
    }

    const portailUrl = `${SITE_URL}/espace-pro/abonnement`;

    const templateData: Record<string, unknown> = {
      prenom,
      nom_commercial: presta.nom_commercial ?? undefined,
    };
    if (templateName === "impaye_suspension") {
      templateData.reactivation_url = portailUrl;
    } else {
      templateData.portail_url = portailUrl;
    }

    const { error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName,
        recipientEmail: presta.email_contact,
        idempotencyKey: opts.idempotencyKey,
        templateData,
      },
    });
    if (error) {
      console.error("enqueueImpayeEmail invoke error", templateName, error);
    }
  } catch (e) {
    console.error("enqueueImpayeEmail failed", templateName, e);
  }
}
