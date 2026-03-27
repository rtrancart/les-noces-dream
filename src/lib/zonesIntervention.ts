export interface ZoneOption {
  value: string;
  label: string;
}

export interface ZoneGroup {
  label: string;
  options: ZoneOption[];
}

export const ZONES_INTERVENTION: ZoneGroup[] = [
  {
    label: "Valeurs spéciales",
    options: [
      { value: "france_entiere", label: "France entière" },
      { value: "international", label: "International (sur devis)" },
    ],
  },
  {
    label: "Régions",
    options: [
      { value: "ile_de_france", label: "Île-de-France" },
      { value: "provence_alpes_cote_azur", label: "Provence-Alpes-Côte d'Azur" },
      { value: "auvergne_rhone_alpes", label: "Auvergne-Rhône-Alpes" },
      { value: "nouvelle_aquitaine", label: "Nouvelle-Aquitaine" },
      { value: "occitanie", label: "Occitanie" },
      { value: "hauts_de_france", label: "Hauts-de-France" },
      { value: "grand_est", label: "Grand Est" },
      { value: "pays_de_la_loire", label: "Pays de la Loire" },
      { value: "normandie", label: "Normandie" },
      { value: "bretagne", label: "Bretagne" },
      { value: "bourgogne_franche_comte", label: "Bourgogne-Franche-Comté" },
      { value: "centre_val_de_loire", label: "Centre-Val de Loire" },
      { value: "corse", label: "Corse" },
    ],
  },
  {
    label: "Départements — Île-de-France",
    options: [
      { value: "75", label: "Paris" },
      { value: "77", label: "Seine-et-Marne" },
      { value: "78", label: "Yvelines" },
      { value: "91", label: "Essonne" },
      { value: "92", label: "Hauts-de-Seine" },
      { value: "93", label: "Seine-Saint-Denis" },
      { value: "94", label: "Val-de-Marne" },
      { value: "95", label: "Val-d'Oise" },
    ],
  },
  {
    label: "Départements — Provence-Alpes-Côte d'Azur",
    options: [
      { value: "04", label: "Alpes-de-Haute-Provence" },
      { value: "05", label: "Hautes-Alpes" },
      { value: "06", label: "Alpes-Maritimes" },
      { value: "13", label: "Bouches-du-Rhône" },
      { value: "83", label: "Var" },
      { value: "84", label: "Vaucluse" },
    ],
  },
  {
    label: "Départements — Auvergne-Rhône-Alpes",
    options: [
      { value: "01", label: "Ain" },
      { value: "03", label: "Allier" },
      { value: "07", label: "Ardèche" },
      { value: "15", label: "Cantal" },
      { value: "26", label: "Drôme" },
      { value: "38", label: "Isère" },
      { value: "42", label: "Loire" },
      { value: "43", label: "Haute-Loire" },
      { value: "63", label: "Puy-de-Dôme" },
      { value: "69", label: "Rhône" },
      { value: "73", label: "Savoie" },
      { value: "74", label: "Haute-Savoie" },
    ],
  },
  {
    label: "Départements — Nouvelle-Aquitaine",
    options: [
      { value: "16", label: "Charente" },
      { value: "17", label: "Charente-Maritime" },
      { value: "19", label: "Corrèze" },
      { value: "23", label: "Creuse" },
      { value: "24", label: "Dordogne" },
      { value: "33", label: "Gironde" },
      { value: "40", label: "Landes" },
      { value: "47", label: "Lot-et-Garonne" },
      { value: "64", label: "Pyrénées-Atlantiques" },
      { value: "79", label: "Deux-Sèvres" },
      { value: "86", label: "Vienne" },
      { value: "87", label: "Haute-Vienne" },
    ],
  },
  {
    label: "Départements — Occitanie",
    options: [
      { value: "09", label: "Ariège" },
      { value: "11", label: "Aude" },
      { value: "12", label: "Aveyron" },
      { value: "30", label: "Gard" },
      { value: "31", label: "Haute-Garonne" },
      { value: "32", label: "Gers" },
      { value: "34", label: "Hérault" },
      { value: "46", label: "Lot" },
      { value: "48", label: "Lozère" },
      { value: "65", label: "Hautes-Pyrénées" },
      { value: "66", label: "Pyrénées-Orientales" },
      { value: "81", label: "Tarn" },
      { value: "82", label: "Tarn-et-Garonne" },
    ],
  },
  {
    label: "Départements — Hauts-de-France",
    options: [
      { value: "02", label: "Aisne" },
      { value: "59", label: "Nord" },
      { value: "60", label: "Oise" },
      { value: "62", label: "Pas-de-Calais" },
      { value: "80", label: "Somme" },
    ],
  },
  {
    label: "Départements — Grand Est",
    options: [
      { value: "08", label: "Ardennes" },
      { value: "10", label: "Aube" },
      { value: "51", label: "Marne" },
      { value: "52", label: "Haute-Marne" },
      { value: "54", label: "Meurthe-et-Moselle" },
      { value: "55", label: "Meuse" },
      { value: "57", label: "Moselle" },
      { value: "67", label: "Bas-Rhin" },
      { value: "68", label: "Haut-Rhin" },
      { value: "88", label: "Vosges" },
    ],
  },
  {
    label: "Départements — Pays de la Loire",
    options: [
      { value: "44", label: "Loire-Atlantique" },
      { value: "49", label: "Maine-et-Loire" },
      { value: "53", label: "Mayenne" },
      { value: "72", label: "Sarthe" },
      { value: "85", label: "Vendée" },
    ],
  },
  {
    label: "Départements — Normandie",
    options: [
      { value: "14", label: "Calvados" },
      { value: "27", label: "Eure" },
      { value: "50", label: "Manche" },
      { value: "61", label: "Orne" },
      { value: "76", label: "Seine-Maritime" },
    ],
  },
  {
    label: "Départements — Bretagne",
    options: [
      { value: "22", label: "Côtes-d'Armor" },
      { value: "29", label: "Finistère" },
      { value: "35", label: "Ille-et-Vilaine" },
      { value: "56", label: "Morbihan" },
    ],
  },
  {
    label: "Départements — Bourgogne-Franche-Comté",
    options: [
      { value: "21", label: "Côte-d'Or" },
      { value: "25", label: "Doubs" },
      { value: "39", label: "Jura" },
      { value: "58", label: "Nièvre" },
      { value: "70", label: "Haute-Saône" },
      { value: "71", label: "Saône-et-Loire" },
      { value: "89", label: "Yonne" },
      { value: "90", label: "Territoire de Belfort" },
    ],
  },
  {
    label: "Départements — Centre-Val de Loire",
    options: [
      { value: "18", label: "Cher" },
      { value: "28", label: "Eure-et-Loir" },
      { value: "36", label: "Indre" },
      { value: "37", label: "Indre-et-Loire" },
      { value: "41", label: "Loir-et-Cher" },
      { value: "45", label: "Loiret" },
    ],
  },
  {
    label: "Départements — Corse",
    options: [
      { value: "2A", label: "Corse-du-Sud" },
      { value: "2B", label: "Haute-Corse" },
    ],
  },
  {
    label: "DOM",
    options: [
      { value: "971", label: "Guadeloupe" },
      { value: "972", label: "Martinique" },
      { value: "973", label: "Guyane" },
      { value: "974", label: "La Réunion" },
      { value: "976", label: "Mayotte" },
    ],
  },
  {
    label: "Pays limitrophes",
    options: [
      { value: "belgique", label: "Belgique" },
      { value: "luxembourg", label: "Luxembourg" },
      { value: "suisse", label: "Suisse" },
      { value: "monaco", label: "Monaco" },
    ],
  },
];

/** Flat lookup: value → label */
export const ZONE_LABELS: Record<string, string> = Object.fromEntries(
  ZONES_INTERVENTION.flatMap((g) => g.options.map((o) => [o.value, o.label]))
);

/** Get display label for a zone value */
export function getZoneLabel(value: string): string {
  return ZONE_LABELS[value] ?? value;
}
