// Configuration Stripe centralisée : identifiants de prix par mode (test/live),
// correspondances price_id <-> (formule, periodicite) et matrice de changement.
//
// Un seul produit Stripe "Abonnement LesNoces.net" avec 4 prix :
//   standard_mensuel (89 €), standard_annuel (948 €),
//   premium_mensuel (149 €), premium_annuel (1 590 €).

export type Formule = "standard" | "premium";
export type Periodicite = "mensuel" | "annuel";
export type PlanKey = "standard_mensuel" | "standard_annuel" | "premium_mensuel" | "premium_annuel";

export const PLAN_KEYS: PlanKey[] = [
  "standard_mensuel",
  "standard_annuel",
  "premium_mensuel",
  "premium_annuel",
];

export type ChangeType =
  | "noop"
  | "upgrade_immediate"
  | "downgrade_scheduled"
  | "periodicite_immediate"
  | "periodicite_scheduled";

export type ProrationBehavior = "always_invoice" | "none" | "create_prorations";

export interface ChangeDecision {
  type: ChangeType;
  prorationBehavior: ProrationBehavior;
  /** true = appliqué tout de suite sur la souscription ; false = programmé en fin de période. */
  immediate: boolean;
  /** true = le changement déclenche un paiement immédiat (refusé si impayé en cours). */
  requiresPayment: boolean;
}

function env(name: string): string | undefined {
  // Deno côté Edge Functions ; process.env côté tests Node/Vitest.
  const d = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno;
  if (d?.env?.get) return d.env.get(name);
  const p = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return p?.env?.[name];
}

export function stripeMode(): "test" | "live" {
  return env("STRIPE_MODE") === "live" ? "live" : "test";
}

/** Identifiants de prix Stripe pour le mode courant. Lu à chaud (pas de cache). */
export function stripePrices(): Record<PlanKey, string | undefined> {
  const suffix = stripeMode() === "live" ? "LIVE" : "TEST";
  return {
    standard_mensuel: env(`STRIPE_PRICE_STANDARD_MENSUEL_${suffix}`),
    standard_annuel: env(`STRIPE_PRICE_STANDARD_ANNUEL_${suffix}`),
    premium_mensuel: env(`STRIPE_PRICE_PREMIUM_MENSUEL_${suffix}`),
    premium_annuel: env(`STRIPE_PRICE_PREMIUM_ANNUEL_${suffix}`),
  };
}

export function planKey(formule: Formule, periodicite: Periodicite): PlanKey {
  return `${formule}_${periodicite}` as PlanKey;
}

export function splitPlanKey(key: PlanKey): { formule: Formule; periodicite: Periodicite } {
  const [formule, periodicite] = key.split("_") as [Formule, Periodicite];
  return { formule, periodicite };
}

/** price_id Stripe → { formule, periodicite }. null si inconnu. */
export function priceIdToPlan(
  priceId: string | null | undefined,
): { formule: Formule; periodicite: Periodicite } | null {
  if (!priceId) return null;
  const prices = stripePrices();
  for (const key of PLAN_KEYS) {
    if (prices[key] && prices[key] === priceId) return splitPlanKey(key);
  }
  return null;
}

/** (formule, periodicite) → price_id Stripe. Lève si le secret n'est pas configuré. */
export function planToPriceId(formule: Formule, periodicite: Periodicite): string {
  const key = planKey(formule, periodicite);
  const priceId = stripePrices()[key];
  if (!priceId) throw new Error(`Price ID manquant pour ${key} (mode ${stripeMode()})`);
  return priceId;
}

/**
 * Matrice de changement d'abonnement.
 * - Formule différente : standard→premium immédiat facturé, premium→standard programmé.
 * - Formule identique : mensuel→annuel immédiat facturé, annuel→mensuel programmé.
 */
export function computeChangeType(
  fromFormule: Formule,
  fromPeriodicite: Periodicite,
  toFormule: Formule,
  toPeriodicite: Periodicite,
): ChangeDecision {
  if (fromFormule === toFormule && fromPeriodicite === toPeriodicite) {
    return { type: "noop", prorationBehavior: "none", immediate: false, requiresPayment: false };
  }

  if (fromFormule !== toFormule) {
    if (fromFormule === "standard" && toFormule === "premium") {
      return {
        type: "upgrade_immediate",
        prorationBehavior: "always_invoice",
        immediate: true,
        requiresPayment: true,
      };
    }
    return {
      type: "downgrade_scheduled",
      prorationBehavior: "none",
      immediate: false,
      requiresPayment: false,
    };
  }

  // Formule constante : seule la périodicité change.
  if (fromPeriodicite === "mensuel" && toPeriodicite === "annuel") {
    return {
      type: "periodicite_immediate",
      prorationBehavior: "always_invoice",
      immediate: true,
      requiresPayment: true,
    };
  }
  return {
    type: "periodicite_scheduled",
    prorationBehavior: "none",
    immediate: false,
    requiresPayment: false,
  };
}

/** Valeur à écrire dans la colonne legacy `plan` (enum plan_abonnement). */
export function legacyPlanValue(formule: Formule, periodicite: Periodicite): PlanKey {
  return planKey(formule, periodicite);
}
