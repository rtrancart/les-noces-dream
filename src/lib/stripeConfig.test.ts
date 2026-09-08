import { describe, it, expect, beforeEach } from "vitest";
import {
  computeChangeType,
  planKey,
  planToPriceId,
  planToPricePromo,
  priceIdToPlan,
  PROMO_END_DATE_ISO,
  type Formule,
  type Periodicite,
} from "../../supabase/functions/_shared/stripe-config";

const FORMULES: Formule[] = ["standard", "premium"];
const PERIODICITES: Periodicite[] = ["mensuel", "annuel"];

describe("computeChangeType — 16 combinaisons", () => {
  it("couvre toute la matrice", () => {
    for (const ff of FORMULES) {
      for (const fp of PERIODICITES) {
        for (const tf of FORMULES) {
          for (const tp of PERIODICITES) {
            const d = computeChangeType(ff, fp, tf, tp);
            if (ff === tf && fp === tp) {
              expect(d.type).toBe("noop");
            } else if (ff !== tf) {
              expect(d.type).toBe(
                ff === "standard" ? "upgrade_immediate" : "downgrade_scheduled",
              );
            } else {
              expect(d.type).toBe(
                fp === "mensuel" ? "periodicite_immediate" : "periodicite_scheduled",
              );
            }
            // Cohérence proration / immédiateté / paiement
            expect(d.immediate).toBe(d.prorationBehavior === "always_invoice");
            expect(d.requiresPayment).toBe(d.immediate);
          }
        }
      }
    }
  });

  it("standard mensuel → premium annuel est un upgrade immédiat facturé", () => {
    const d = computeChangeType("standard", "mensuel", "premium", "annuel");
    expect(d).toMatchObject({
      type: "upgrade_immediate",
      prorationBehavior: "always_invoice",
      requiresPayment: true,
    });
  });

  it("premium annuel → standard mensuel est programmé sans proration", () => {
    const d = computeChangeType("premium", "annuel", "standard", "mensuel");
    expect(d).toMatchObject({
      type: "downgrade_scheduled",
      prorationBehavior: "none",
      requiresPayment: false,
    });
  });

  it("standard annuel → standard mensuel est programmé", () => {
    expect(computeChangeType("standard", "annuel", "standard", "mensuel").type).toBe(
      "periodicite_scheduled",
    );
  });
});

describe("résolution des price_ids", () => {
  beforeEach(() => {
    process.env.STRIPE_MODE = "test";
    process.env.STRIPE_PRICE_STANDARD_MENSUEL_TEST = "price_sm";
    process.env.STRIPE_PRICE_STANDARD_ANNUEL_TEST = "price_sa";
    process.env.STRIPE_PRICE_PREMIUM_MENSUEL_TEST = "price_pm";
    process.env.STRIPE_PRICE_PREMIUM_ANNUEL_TEST = "price_pa";
    process.env.STRIPE_PRICE_PROMO_STANDARD_MENSUEL_TEST = "price_sm_promo";
    process.env.STRIPE_PRICE_PROMO_STANDARD_ANNUEL_TEST = "price_sa_promo";
    process.env.STRIPE_PRICE_PROMO_PREMIUM_MENSUEL_TEST = "price_pm_promo";
    process.env.STRIPE_PRICE_PROMO_PREMIUM_ANNUEL_TEST = "price_pa_promo";
  });

  it("planToPriceId et priceIdToPlan sont réciproques (prix normaux)", () => {
    for (const f of FORMULES) {
      for (const p of PERIODICITES) {
        const id = planToPriceId(f, p);
        expect(priceIdToPlan(id)).toEqual({ formule: f, periodicite: p, is_promo: false });
      }
    }
  });

  it("planToPricePromo et priceIdToPlan sont réciproques (prix promo)", () => {
    for (const f of FORMULES) {
      for (const p of PERIODICITES) {
        const id = planToPricePromo(f, p);
        expect(id).not.toBe(planToPriceId(f, p));
        expect(priceIdToPlan(id)).toEqual({ formule: f, periodicite: p, is_promo: true });
      }
    }
  });

  it("renvoie null pour un price_id inconnu", () => {
    expect(priceIdToPlan("price_inexistant")).toBeNull();
    expect(priceIdToPlan(null)).toBeNull();
  });

  it("lève si le secret est absent", () => {
    delete process.env.STRIPE_PRICE_PREMIUM_ANNUEL_TEST;
    expect(() => planToPriceId("premium", "annuel")).toThrow();
    delete process.env.STRIPE_PRICE_PROMO_PREMIUM_ANNUEL_TEST;
    expect(() => planToPricePromo("premium", "annuel")).toThrow();
  });

  it("planKey construit la clé attendue", () => {
    expect(planKey("premium", "annuel")).toBe("premium_annuel");
  });

  it("expose la date butoir de l'offre de lancement", () => {
    expect(PROMO_END_DATE_ISO).toBe("2026-12-31T23:59:59Z");
    expect(new Date(PROMO_END_DATE_ISO).getTime()).toBeGreaterThan(0);
  });
});
