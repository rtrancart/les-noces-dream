/**
 * Accords grammaticaux des libellés de catégorie (H1, sous-titres, metas).
 *
 * Source de vérité : colonnes `nom_singulier` et `genre` de `public.categories`.
 * Aucun libellé codé en dur par catégorie : tout passe par ces deux champs, de
 * sorte que le gabarit est réplicable à toute catégorie (mère ou fille).
 */

export type Genre = "masculin" | "feminin";

export interface CategorieLabelInput {
  /** Nom d'affichage de la catégorie (pluriel ou non, tel que saisi en admin). */
  nom: string;
  nom_singulier?: string | null;
  genre?: string | null;
}

/** Repli sûr quand `nom_singulier` n'est pas encore renseigné. */
export function singulier(cat: CategorieLabelInput): string {
  const s = (cat.nom_singulier ?? "").trim();
  return (s || cat.nom).toLocaleLowerCase("fr-FR");
}

export function genreDe(cat: CategorieLabelInput): Genre {
  return cat.genre === "feminin" ? "feminin" : "masculin";
}

/**
 * Pluriel français du premier mot du groupe nominal :
 *   « lieu de réception » → « lieux de réception »
 *   « agent de sécurité » → « agents de sécurité »
 *   « photographe »       → « photographes »
 */
export function pluralise(expr: string): string {
  const mots = expr.split(" ");
  const tete = mots[0] ?? "";
  mots[0] = plurielMot(tete);
  return mots.join(" ");
}

function plurielMot(mot: string): string {
  const m = mot.toLocaleLowerCase("fr-FR");
  if (!m) return mot;
  if (/(s|x|z)$/.test(m)) return mot;
  if (/(eau|au|eu)$/.test(m)) return `${mot}x`;
  if (/al$/.test(m)) return `${mot.slice(0, -2)}aux`;
  if (/^(lieu)$/.test(m)) return `${mot}x`;
  return `${mot}s`;
}

export function pluriel(cat: CategorieLabelInput): string {
  return pluralise(singulier(cat));
}

/** « votre » est invariable en genre — utilitaire conservé pour lisibilité. */
export function determinantPossessif(): string {
  return "votre";
}

/** « les meilleurs photographes » / « les meilleures robes de mariée ». */
export function lesMeilleurs(cat: CategorieLabelInput): string {
  const adj = genreDe(cat) === "feminin" ? "les meilleures" : "les meilleurs";
  return `${adj} ${pluriel(cat)}`;
}

/** « vérifiés » / « vérifiées », accordé au genre et au pluriel. */
export function accordePluriel(cat: CategorieLabelInput, participe: string): string {
  return genreDe(cat) === "feminin" ? `${participe}es` : `${participe}s`;
}

export interface ZoneLabel {
  /** « à Lyon » pour une ville, « en Bretagne » pour une région/département. */
  type: "ville" | "region" | "departement";
  label: string;
}

/** Suffixe géographique : « à Lyon », « en Bretagne ». */
export function suffixeZone(zone: ZoneLabel | null): string {
  if (!zone) return "";
  return zone.type === "ville" ? ` à ${zone.label}` : ` en ${zone.label}`;
}

/** H1 : « Trouvez votre lieu de réception de mariage en Bretagne ». */
export function titreH1(cat: CategorieLabelInput, zone: ZoneLabel | null): string {
  return `Trouvez votre ${singulier(cat)} de mariage${suffixeZone(zone)}`;
}

/** Sous-titre : « 36 professionnels sélectionnés et validés par LesNoces.net ». */
export function sousTitre(nb: number): string {
  const mot = nb === 1 ? "professionnel sélectionné et validé" : "professionnels sélectionnés et validés";
  return `${nb} ${mot} par LesNoces.net`;
}

/** Titre de la grille : « 36 lieux de réception en France ». */
export function titreGrille(
  cat: CategorieLabelInput,
  nb: number,
  zoneLabel: string | null,
): string {
  const nom = nb === 1 ? singulier(cat) : pluriel(cat);
  return `${nb} ${nom} ${zoneLabel ? (zoneLabel === "France" ? "en France" : zoneLabel) : "en France"}`;
}

/** Meta title (≤ ~60 caractères visés) — surchargeable en admin. */
export function metaTitreAuto(
  cat: CategorieLabelInput,
  zoneLabel: string | null,
): string {
  const nom = capitaliser(pluriel(cat));
  const zone = zoneLabel && zoneLabel !== "France" ? zoneLabel : "France";
  return `${nom} de mariage en ${zone} | LesNoces.net`;
}

/**
 * Meta description automatique, grammaticalement accordée, avec le nombre réel :
 * « 36 lieux de réception de mariage vérifiés en France sur LesNoces.net : … ».
 */
export function metaDescriptionAuto(
  cat: CategorieLabelInput,
  nb: number,
  zoneLabel: string | null,
): string {
  const nom = nb === 1 ? singulier(cat) : pluriel(cat);
  const verifie = nb === 1
    ? genreDe(cat) === "feminin" ? "vérifiée" : "vérifié"
    : accordePluriel(cat, "vérifié");
  const zone = zoneLabel && zoneLabel !== "France" ? zoneLabel : "France";
  return `${nb} ${nom} de mariage ${verifie} en ${zone} sur LesNoces.net : photos, capacités, tarifs indicatifs et avis. Comparez les fiches et contactez directement les prestataires, sans commission.`;
}

export function capitaliser(s: string): string {
  return s.charAt(0).toLocaleUpperCase("fr-FR") + s.slice(1);
}

/** Titre de section éditoriale : « Comment choisir votre lieu de réception ». */
export function titreEditorial(cat: CategorieLabelInput): string {
  return `Comment choisir votre ${singulier(cat)}`;
}

/** Titre du maillage vers les filles : « Types de lieux de réception ». */
export function titreTypes(cat: CategorieLabelInput): string {
  return `Types de ${pluriel(cat)}`;
}

/** Alt d'image : « Château de Valmorel, lieu de réception à Aix-en-Provence ». */
export function altPhoto(
  nom: string,
  cat: CategorieLabelInput | null,
  ville: string | null,
): string {
  const parts = [nom];
  if (cat) parts.push(singulier(cat));
  if (ville) parts.push(`à ${ville}`);
  return parts.length === 3 ? `${parts[0]}, ${parts[1]} ${parts[2]}` : parts.join(", ");
}

/** Remplace le jeton {n} d'un texte éditorial par le nombre réel. */
export function injecteNombre(texte: string | null | undefined, nb: number): string {
  if (!texte) return "";
  return texte.replace(/\{n\}/g, String(nb));
}
