import { describe, it, expect } from "vitest";
import { buildServicesGroups, type SourceChamp } from "./servicesPrestations";

const champs: SourceChamp[] = [
  { label: "Métier", cle: "metier", type_champ: "liste", groupe: "Photo / Vidéo" },
  { label: "Couverture", cle: "type_prestation", type_champ: "multi_choix", groupe: "Photo / Vidéo" },
  { label: "Style", cle: "style", type_champ: "multi_choix", groupe: "Photo / Vidéo" },
  { label: "Séance engagement", cle: "seance_engagement", type_champ: "booleen", groupe: "Photo / Vidéo" },
  { label: "Drone", cle: "drone", type_champ: "booleen", groupe: "Photo / Vidéo" },
  { label: "Album photo", cle: "album_photo", type_champ: "booleen", groupe: "Photo / Vidéo" },
  { label: "Plusieurs mariages le même jour", cle: "disponibilite_simultanee", type_champ: "booleen", groupe: "Photo / Vidéo" },
  { label: "Photos livrées", cle: "nombre_photos_livrees", type_champ: "liste", groupe: "Photo / Vidéo" },
  { label: "Délai de livraison", cle: "delai_livraison", type_champ: "liste", groupe: "Photo / Vidéo" },
  { label: "Supports", cle: "livraison_fichiers", type_champ: "multi_choix", groupe: "Photo / Vidéo" },
  { label: "Zone d'intervention", cle: "zone_intervention", type_champ: "liste", groupe: "Profil & prestation" },
  { label: "Expérience", cle: "experience", type_champ: "liste", groupe: "Profil & prestation" },
  { label: "Acompte", cle: "montant_acompte", type_champ: "liste", groupe: "Conditions commerciales" },
  { label: "Paiement", cle: "moyens_paiement", type_champ: "multi_choix", groupe: "Conditions commerciales" },
];

const values: Record<string, unknown> = {
  metier: "Photographe et vidéaste",
  type_prestation: ["Journée complète", "Demi-journée"],
  style: ["Reportage"],
  seance_engagement: true,
  drone: true,
  album_photo: false,
  disponibilite_simultanee: false,
  nombre_photos_livrees: "500 à 800",
  delai_livraison: "4 à 8 semaines",
  livraison_fichiers: ["Galerie en ligne"],
  zone_intervention: "France entière",
  experience: "5 à 10 ans",
  montant_acompte: "30 %",
  moyens_paiement: ["Carte bancaire", "Virement"],
};

describe("buildServicesGroups", () => {
  it("distributes fields into the five expected buckets", () => {
    const groups = buildServicesGroups(champs, values);

    expect(groups.map((g) => g.id)).toEqual(["prestation", "inclus", "livraison", "organisation", "conditions"]);

    const prestation = groups.find((g) => g.id === "prestation")!;
    expect(prestation.fields.map((f) => f.key)).toEqual(["metier", "type_prestation", "style"]);
    expect(prestation.summary).toBe("Photographe et vidéaste");

    const inclus = groups.find((g) => g.id === "inclus")!;
    expect(inclus.fields.map((f) => f.key)).toEqual([
      "drone",
      "seance_engagement",
      "album_photo",
      "disponibilite_simultanee",
    ]);
    expect(inclus.fields[0].value).toBe(true);
    expect(inclus.fields[2].value).toBe(false);
    expect(inclus.summary).toBe("2 inclus · 2 non");

    const livraison = groups.find((g) => g.id === "livraison")!;
    expect(livraison.fields.map((f) => f.key)).toEqual([
      "nombre_photos_livrees",
      "delai_livraison",
      "livraison_fichiers",
    ]);

    const organisation = groups.find((g) => g.id === "organisation")!;
    expect(organisation.fields.map((f) => f.key)).toEqual(["zone_intervention", "experience"]);
    expect(organisation.summary).toBe("France entière");

    const conditions = groups.find((g) => g.id === "conditions")!;
    expect(conditions.fields.map((f) => f.key)).toEqual(["montant_acompte", "moyens_paiement"]);
  });

  it("skips empty groups and un-filled fields", () => {
    const groups = buildServicesGroups(
      [
        { label: "Métier", cle: "metier", type_champ: "liste", groupe: "Photo / Vidéo" },
        { label: "Drone", cle: "drone", type_champ: "booleen", groupe: "Photo / Vidéo" },
      ],
      { metier: "Photographe" },
    );
    expect(groups.map((g) => g.id)).toEqual(["prestation"]);
  });

  it("keeps boolean false as a filled value", () => {
    const groups = buildServicesGroups(
      [{ label: "Test", cle: "test", type_champ: "booleen", groupe: "Photo / Vidéo" }],
      { test: false },
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].fields[0].value).toBe(false);
  });

  it("drops null or empty values", () => {
    const groups = buildServicesGroups(
      [
        { label: "Métier", cle: "metier", type_champ: "liste", groupe: "Photo / Vidéo" },
        { label: "Style", cle: "style", type_champ: "multi_choix", groupe: "Photo / Vidéo" },
      ],
      { metier: null, style: [] },
    );
    expect(groups).toHaveLength(0);
  });
});
