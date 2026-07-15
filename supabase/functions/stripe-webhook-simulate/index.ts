// Simulateur d'événements Stripe (admin uniquement) — pour valider les écritures DB
// sans passer par un vrai webhook signé. À utiliser uniquement en test.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const admin = createClient(
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth: caller must be admin/super_admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauth" }, 401);
  const authed = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: u } = await authed.auth.getUser();
  if (!u?.user) return json({ error: "unauth" }, 401);
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
  const { data: isSuper } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "super_admin" });
  if (!isAdmin && !isSuper) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const {
    event_type,
    prestataire_id,
    formule = "standard",
    trial_end_offset_days = null, // null = pas d'essai; positif = essai en cours; négatif = essai déjà terminé
    cancel_at_period_end = false,
    status_override = null, // ex "active", "trialing", "past_due"
  } = body;

  if (!event_type || !prestataire_id) return json({ error: "event_type et prestataire_id requis" }, 400);

  const now = Math.floor(Date.now() / 1000);
  const trialEnd = trial_end_offset_days != null
    ? now + Math.round(trial_end_offset_days * 86400)
    : null;
  const currentPeriodEnd = trialEnd && trialEnd > now
    ? trialEnd
    : now + 30 * 86400;
  const stripeStatus = status_override
    ?? (trialEnd && trialEnd > now ? "trialing" : "active");

  const sub = {
    id: `sub_sim_${prestataire_id.slice(0, 8)}`,
    customer: `cus_sim_${prestataire_id.slice(0, 8)}`,
    status: stripeStatus,
    cancel_at_period_end,
    current_period_end: currentPeriodEnd,
    start_date: now,
    trial_end: trialEnd,
    items: { data: [{ price: { unit_amount: 6900 } }] },
    metadata: { prestataire_id, formule },
    cancellation_details: null,
  };

  if (event_type === "checkout.session.completed" || event_type === "customer.subscription.created" || event_type === "customer.subscription.updated") {
    await syncSubscription(sub);
  } else if (event_type === "invoice.payment_succeeded") {
    await syncSubscription(sub);
    await admin.from("abonnements").update({
      statut: "actif",
      fin_periode_le: new Date(currentPeriodEnd * 1000).toISOString(),
      derniere_facture_id: `in_sim_${Date.now()}`,
      nb_echecs_paiement: 0,
      suspendu_pour_impaye_le: null,
    }).eq("prestataire_id", prestataire_id);
    await admin.rpc("reactiver_prestataire_paiement", { p_prestataire_id: prestataire_id });
  } else if (event_type === "invoice.payment_failed") {
    const { data: cur } = await admin.from("abonnements")
      .select("nb_echecs_paiement").eq("prestataire_id", prestataire_id).maybeSingle();
    const nb = (cur?.nb_echecs_paiement ?? 0) + 1;
    await admin.from("abonnements").update({ statut: "en_retard", nb_echecs_paiement: nb })
      .eq("prestataire_id", prestataire_id);
  } else {
    return json({ error: `event_type non supporté: ${event_type}` }, 400);
  }

  const { data: abo } = await admin.from("abonnements")
    .select("*").eq("prestataire_id", prestataire_id).maybeSingle();
  return json({ ok: true, event_type, simulated_sub: sub, abonnement: abo });
});

async function syncSubscription(sub: any) {
  const prestataireId = sub.metadata?.prestataire_id;
  if (!prestataireId) return;

  const formule = sub.metadata?.formule as Formule | undefined;
  const plan = formule ? PLAN_BY_FORMULE[formule] : null;
  const montantCents = sub.items?.data?.[0]?.price?.unit_amount ?? null;
  const customerId = sub.customer;

  let statut = "actif";
  if (sub.cancel_at_period_end) statut = "resilie";
  else if (sub.status === "trialing") statut = "trialing";
  else if (sub.status === "active") statut = "actif";
  else if (sub.status === "past_due" || sub.status === "unpaid") statut = "en_retard";
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
  if (sub.cancel_at_period_end) patch.resilie_le = new Date().toISOString();

  const { data: existing } = await admin.from("abonnements")
    .select("id").eq("prestataire_id", prestataireId).maybeSingle();
  if (existing?.id) {
    await admin.from("abonnements").update(patch).eq("id", existing.id);
  } else {
    await admin.from("abonnements").insert({
      prestataire_id: prestataireId,
      plan: plan ?? "mensuel",
      ...patch,
    });
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
