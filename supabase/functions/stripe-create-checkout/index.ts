// Crée une session Stripe Checkout, ou modifie l'abonnement existant.
// - Upgrade (plan de rang supérieur) : mise à jour immédiate avec proration (always_invoice).
// - Downgrade (plan de rang inférieur) : Subscription Schedule → bascule en fin de période, sans avoir.
// - Aucune sub → Checkout classique (1re souscription).
// Retourne { url } (checkout), { changed: true, mode: 'upgrade' | 'downgrade' | 'noop' }, ou { error }.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

type Formule = "standard" | "premium" | "annuel";

const PRICE_BY_FORMULE: Record<Formule, string | undefined> = {
  standard: Deno.env.get("STRIPE_PRICE_STANDARD"),
  premium: Deno.env.get("STRIPE_PRICE_PREMIUM"),
  annuel: Deno.env.get("STRIPE_PRICE_ANNUEL"),
};

const PLAN_BY_FORMULE: Record<Formule, string> = {
  standard: "standard_mensuel",
  premium: "premium_mensuel",
  annuel: "annuel",
};

// Rangs de formule : sert à déterminer upgrade vs downgrade.
// standard (89€) < premium (149€) < annuel (79€/mois avec engagement 12 mois → rang supérieur).
const RANG: Record<Formule, number> = { standard: 1, premium: 2, annuel: 3 };

function formuleFromPriceId(priceId: string | null | undefined): Formule | null {
  if (!priceId) return null;
  for (const f of ["standard", "premium", "annuel"] as Formule[]) {
    if (PRICE_BY_FORMULE[f] === priceId) return f;
  }
  return null;
}

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

      // Garde : refuser le changement de formule pendant un impayé
      if (primary.status === "past_due" || primary.status === "unpaid") {
        return json({
          error: "unpaid_subscription",
          message: "Régularisez votre paiement avant de changer de formule.",
        }, 409);
      }

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
      const alreadyOnTargetPrice = currentPriceId === priceId;

      if (alreadyOnTargetPrice) {
        // Si l'utilisateur reclique sur sa formule courante alors qu'un downgrade
        // est programmé, on considère qu'il annule le downgrade.
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

      // Déterminer upgrade vs downgrade
      const currentFormule = formuleFromPriceId(currentPriceId);
      const isUpgrade = currentFormule ? RANG[formule] > RANG[currentFormule] : true;

      // Si un schedule existe déjà et que l'utilisateur reclique sur un plan différent,
      // on libère l'ancien schedule avant d'appliquer la nouvelle logique.
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

      if (isUpgrade) {
        // Upgrade immédiat, facturation de la proration
        await stripe.subscriptions.update(primary.id, {
          items: [{ id: currentItem.id, price: priceId }],
          proration_behavior: "always_invoice",
          billing_cycle_anchor: "unchanged",
          cancel_at_period_end: false,
          metadata: {
            prestataire_id: prestataire.id,
            user_id: userId,
            formule,
          },
        });
        return json({ changed: true, mode: "upgrade" });
      } else {
        // Downgrade programmé : Subscription Schedule
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
              },
            },
          ],
          metadata: {
            prestataire_id: prestataire.id,
            user_id: userId,
            formule_cible: formule,
          },
        });

        // Reflet côté DB pour l'UI
        if (abo?.id) {
          await supabaseAdmin
            .from("abonnements")
            .update({
              plan_pending: PLAN_BY_FORMULE[formule],
              plan_pending_le: new Date(primary.current_period_end * 1000).toISOString(),
              stripe_schedule_id: schedule.id,
            })
            .eq("id", abo.id);
        }

        return json({
          changed: true,
          mode: "downgrade",
          plan_pending: PLAN_BY_FORMULE[formule],
          plan_pending_le: new Date(primary.current_period_end * 1000).toISOString(),
        });
      }
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
