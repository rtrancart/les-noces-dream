import { describe, it, expect } from "vitest";
import { calculerCoutIa, formaterCoutIa } from "./iaCout";

describe("calculerCoutIa", () => {
  it("applique (in×prix_in + out×prix_out)/1 000 000", () => {
    expect(calculerCoutIa(1000, 500, { model: "m", prix_entree_eur_par_million: 2, prix_sortie_eur_par_million: 6 })).toBeCloseTo(0.005);
  });
  it("renvoie tarif manquant si un prix est NULL", () => {
    const c = calculerCoutIa(1000, 500, { model: "m", prix_entree_eur_par_million: null, prix_sortie_eur_par_million: 6 });
    expect(formaterCoutIa(c)).toBe("tarif manquant");
  });
});
