// Crée une session Stripe Checkout, ou modifie l'abonnement existant.
// Modèle à 2 dimensions : formule (standard | premium) x periodicite (mensuel | annuel).
// La décision est prise par computeChangeType (_shared/stripe-config.ts) :
//  - upgrade_immediate / periodicite_immediate : update de la sub avec proration facturée
//  - downgrade_scheduled / periodicite_scheduled : Subscription Schedule en fin de période
//  - noop : rien, sauf annulation d'un changement déjà programmé
// Retourne { url } (checkout), { changed, mode, ... }, ou { error }.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";
import {
  computeChangeType,
  type Formule,
  legacyPlanValue,
  type Periodicite,
  planToPriceId,
  priceIdToPlan,
} from "../_shared/stripe-config.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-11-20.acacia",
});

/** Accepte le nouveau format (formule + periodicite) et l'ancien paramètre unique. */
function parseTarget(
  body: { formule?: string; periodicite?: string },
): { formule: Formule; periodicite: Periodicite } | null {
  const f = body?.formule;
  const p = body?.periodicite;
  if (f === "standard" || f === "premium") {
    if (p === "mensuel" || p === "annuel") return { formule: f, periodicite: p };
    if (!p) return { formule: f, periodicite: "mensuel" };
    return null;
  }
  // Ancien format transitoire : "annuel" = standard annuel.
  if (f === "annuel") return { formule: "standard", periodicite: "annuel" };
  return null;
}

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
    const target = parseTarget(body);
    if (!target) return json({ error: "Formule ou périodicité invalide" }, 400);
    const { formule, periodicite } = target;

    let priceId: string;
    try {
      priceId = planToPriceId(formule, periodicite);
    } catch (_e) {
      return json({ error: `Price ID manquant pour ${formule} ${periodicite}` }, 500);
    }

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
      .select("id, stripe_customer_id, fin_essai_le, stripe_schedule_id")
      .eq("prestataire_id", prestataire.id)
      .maybeSingle();

    // 1. Customer Stripe
    let customerId = abo?.stripe_customer_id ?? null;
    if (customerId) {
      try {
        const existing = await stripe.customers.retrieve(customerId);
        if ((existing as Stripe.DeletedCustomer).deleted) customerId = null;
      } catch (_e) {
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
    }

    // 2. Sub existante ?
    const existingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
    });
    const activeSubs = existingSubs.data.filter((s) =>
      ["active", "trialing", "past_due", "unpaid"].includes(s.status)
    );

    if (activeSubs.length > 0) {
      activeSubs.sort((a, b) => a.created - b.created);
      const primary = activeSubs[0];
      const duplicates = activeSubs.slice(1);
      const impaye = primary.status === "past_due" || primary.status === "unpaid";

      // Annule les doublons éventuels
      for (const dup of duplicates) {
        try {
          await stripe.subscriptions.cancel(dup.id, { prorate: true });
        } catch (e) {
          console.error("Failed to cancel duplicate subscription", dup.id, e);
        }
      }

      const currentItem = primary.items.data[0];
      const currentPriceId = currentItem?.price?.id ?? null;
      const current = priceIdToPlan(currentPriceId);

      const decision = current
        ? computeChangeType(current.formule, current.periodicite, formule, periodicite)
        // Price inconnu (ancien prix) : on traite comme un changement immédiat.
        : {
          type: "upgrade_immediate" as const,
          prorationBehavior: "always_invoice" as const,
          immediate: true,
          requiresPayment: true,
        };

      if (currentPriceId === priceId || decision.type === "noop") {
        // Reclic sur la formule courante : annule un changement programmé s'il existe.
        // Autorisé même en impayé.
        if (abo?.stripe_schedule_id) {
          try {
            await stripe.subscriptionSchedules.release(abo.stripe_schedule_id);
          } catch (e) {
            const code = (e as { code?: string })?.code;
            if (code !== "resource_missing") console.warn("release existing schedule failed", e);
          }
          await supabaseAdmin
            .from("abonnements")
            .update({ plan_pending: null, plan_pending_le: null, stripe_schedule_id: null })
            .eq("id", abo.id);
          return json({ changed: true, mode: "schedule_cancelled" });
        }
        return json({ changed: false, mode: "noop", message: "Vous êtes déjà sur cette formule." });
      }

      // Garde impayé : uniquement pour les changements qui déclenchent un paiement.
      if (impaye && decision.requiresPayment) {
        return json({
          error: "unpaid_subscription",
          message: "Régularisez votre paiement avant de passer à cette formule.",
        }, 409);
      }

      // Un schedule existant est libéré avant d'appliquer la nouvelle décision.
      if (abo?.stripe_schedule_id) {
        try {
          await stripe.subscriptionSchedules.release(abo.stripe_schedule_id);
        } catch (e) {
          const code = (e as { code?: string })?.code;
          if (code !== "resource_missing") console.warn("release existing schedule failed", e);
        }
        await supabaseAdmin
          .from("abonnements")
          .update({ plan_pending: null, plan_pending_le: null, stripe_schedule_id: null })
          .eq("id", abo.id);
      }

      if (decision.immediate) {
        await stripe.subscriptions.update(primary.id, {
          items: [{ id: currentItem.id, price: priceId }],
          proration_behavior: decision.prorationBehavior,
          payment_behavior: "error_if_incomplete",
          billing_cycle_anchor: "unchanged",
          cancel_at_period_end: false,
          metadata: {
            prestataire_id: prestataire.id,
            user_id: userId,
            formule,
            periodicite,
          },
        });
        return json({ changed: true, mode: decision.type });
      }

      // Changement programmé : Subscription Schedule
      const schedule = await stripe.subscriptionSchedules.create({
        from_subscription: primary.id,
      });
      const phaseCurrent = schedule.phases[0];
      await stripe.subscriptionSchedules.update(schedule.id, {
        end_behavior: "release",
        phases: [
          {
            items: [{ price: currentPriceId!, quantity: 1 }],
            start_date: phaseCurrent.start_date,
            end_date: phaseCurrent.end_date,
            proration_behavior: "none",
          },
          {
            items: [{ price: priceId, quantity: 1 }],
            iterations: 1,
            proration_behavior: "none",
            metadata: {
              prestataire_id: prestataire.id,
              user_id: userId,
              formule,
              periodicite,
            },
          },
        ],
        metadata: {
          prestataire_id: prestataire.id,
          user_id: userId,
          formule_cible: formule,
          periodicite_cible: periodicite,
        },
      });

      const planPending = legacyPlanValue(formule, periodicite);
      const planPendingLe = new Date(primary.current_period_end * 1000).toISOString();

      if (abo?.id) {
        await supabaseAdmin
          .from("abonnements")
          .update({
            plan_pending: planPending,
            plan_pending_le: planPendingLe,
            stripe_schedule_id: schedule.id,
          })
          .eq("id", abo.id);
      }

      return json({
        changed: true,
        mode: decision.type,
        plan_pending: planPending,
        plan_pending_le: planPendingLe,
      });
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
          periodicite,
        },
      },
      success_url: `${origin}/espace-pro/abonnement?statut=succes`,
      cancel_url: `${origin}/espace-pro/abonnement?statut=annule`,
      metadata: {
        prestataire_id: prestataire.id,
        formule,
        periodicite,
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
