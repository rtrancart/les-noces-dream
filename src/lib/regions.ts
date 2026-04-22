// Mapping slug ↔ nom officiel des régions françaises.
// La table prestataires.region stocke les noms lisibles, donc on convertit
// le slug d'URL vers le nom pour faire le matching.

export const REGIONS = [
  { slug: "ile-de-france", nom: "Île-de-France" },
  { slug: "provence-alpes-cote-d-azur", nom: "Provence-Alpes-Côte d'Azur" },
  { slug: "nouvelle-aquitaine", nom: "Nouvelle-Aquitaine" },
  { slug: "auvergne-rhone-alpes", nom: "Auvergne-Rhône-Alpes" },
  { slug: "occitanie", nom: "Occitanie" },
  { slug: "hauts-de-france", nom: "Hauts-de-France" },
  { slug: "bretagne", nom: "Bretagne" },
  { slug: "normandie", nom: "Normandie" },
  { slug: "pays-de-la-loire", nom: "Pays de la Loire" },
  { slug: "grand-est", nom: "Grand Est" },
  { slug: "bourgogne-franche-comte", nom: "Bourgogne-Franche-Comté" },
  { slug: "centre-val-de-loire", nom: "Centre-Val de Loire" },
  { slug: "corse", nom: "Corse" },
] as const;

export type RegionSlug = (typeof REGIONS)[number]["slug"];

const SLUG_TO_NOM = new Map(REGIONS.map((r) => [r.slug, r.nom]));
const NOM_TO_SLUG = new Map<string, string>();
for (const r of REGIONS) {
  NOM_TO_SLUG.set(r.nom, r.slug);
  // Variante sans tiret pour Nouvelle-Aquitaine -> "Nouvelle Aquitaine"
  NOM_TO_SLUG.set(r.nom.replace(/-/g, " "), r.slug);
}

export function regionSlugToNom(slug: string): string | undefined {
  return SLUG_TO_NOM.get(slug);
}

export function regionNomToSlug(nom: string | null | undefined): string | undefined {
  if (!nom) return undefined;
  return NOM_TO_SLUG.get(nom.trim());
}
