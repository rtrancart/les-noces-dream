import { describe, expect, it } from "vitest";
import { aFaireCeMois, construireSections, dateReference, echeance, type Tache } from "./planning";

const t = (id: string, date_echeance: string, priorite = 1, faite = false, extra: Partial<Tache> = {}): Tache => ({
  id, user_id: "u", modele_id: "m" + id, titre: id, description: null, categorie: "Organisation", date_echeance,
  echeance_origine: date_echeance, priorite, faite, faite_le: null, masquee: false, perso: false, ...extra,
});

describe("échéances", () => {
  it("12 mois avant", () => expect(echeance("2027-06-19", 12)).toBe("2026-06-19"));
  it("1 semaine avant (0,25)", () => expect(echeance("2027-06-19", 0.25)).toBe("2027-06-12"));
  it("15 jours avant (0,5)", () => expect(echeance("2027-06-19", 0.5)).toBe("2027-06-04"));
  it("1 mois après (-1)", () => expect(echeance("2027-06-19", -1)).toBe("2027-07-19"));
  it("15 jours après (-0,5)", () => expect(echeance("2027-06-19", -0.5)).toBe("2027-07-04"));
  it("mois et année seuls : le 15", () => expect(dateReference({ date_mois: 9, date_annee: 2027 })).toBe("2027-09-15"));
});

describe("À rattraper", () => {
  const jour = "2026-11-12";
  const ref = "2027-04-12";
  const taches = [t("a", "2026-04-12", 2), t("b", "2026-05-12", 1), t("c", "2026-06-12", 3), t("d", "2026-06-01", 1, true), t("e", "2026-11-30", 1), t("f", "2027-05-12", 2)];
  const s = construireSections(taches, ref, jour);
  it("tâches non faites en retard, priorité puis échéance d'origine", () => expect(s.rattraper.map((x) => x.id)).toEqual(["b", "a"]));
  it("facultatives en retard à part", () => expect(s.rattraperFacultatives.map((x) => x.id)).toEqual(["c"]));
  it("une tâche faite n'est pas à rattraper", () => expect(s.rattraper.some((x) => x.id === "d")).toBe(false));
  it("après le mariage", () => expect(s.apres.map((x) => x.id)).toEqual(["f"]));
  it("à faire ce mois-ci : rattrapage d'abord, 3 max", () => expect(aFaireCeMois(taches, ref, jour).map((x) => x.id)).toEqual(["b", "a", "e"]));
  it("mariage passé : seulement l'après", () => {
    const p = construireSections(taches, "2026-10-01", jour);
    expect(p.mariagePasse).toBe(true);
    expect(aFaireCeMois(taches, "2026-10-01", jour).every((x) => x.date_echeance > "2026-10-01")).toBe(true);
  });
});
