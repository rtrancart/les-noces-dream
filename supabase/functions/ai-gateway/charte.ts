// ─── Usages 'charte' et 'vision' : contrôles côté code ───

export const AMBIANCES = ["Champêtre", "Bohème", "Romantique", "Chic / classique", "Minimaliste", "Moderne / contemporain",
  "Vintage / rétro", "Baroque", "Art déco", "Industriel", "Méditerranéen", "Tropical / exotique", "Nature / forêt",
  "Bord de mer", "Glamour", "Sobre / corporate"];
export const ROLES = ["principale", "secondaire", "accent", "fond", "texte"] as const;

// Familles de couleurs (pastilles du questionnaire) → test d'appartenance d'un code hexadécimal.
type Hsl = { h: number; s: number; l: number };
export const FAMILLES: Record<string, (c: Hsl) => boolean> = {
  blanc: (c) => c.l >= 0.94,
  noir: (c) => c.l <= 0.12,
  gris: (c) => c.s < 0.1 && c.l > 0.12 && c.l < 0.94,
  rouge: (c) => c.s >= 0.25 && (c.h >= 345 || c.h < 12) && c.l > 0.15 && c.l < 0.8,
  rose: (c) => c.s >= 0.2 && ((c.h >= 300 && c.h < 345) || ((c.h >= 345 || c.h < 15) && c.l >= 0.7)),
  orange: (c) => c.s >= 0.3 && c.h >= 12 && c.h < 40 && c.l >= 0.35 && c.l < 0.85,
  marron: (c) => c.s >= 0.15 && c.h >= 10 && c.h < 45 && c.l > 0.12 && c.l < 0.35,
  jaune: (c) => c.s >= 0.3 && c.h >= 40 && c.h < 65 && c.l > 0.25 && c.l < 0.92,
  vert: (c) => c.s >= 0.1 && c.h >= 65 && c.h < 170 && c.l > 0.1 && c.l < 0.94,
  bleu: (c) => c.s >= 0.12 && c.h >= 170 && c.h < 255 && c.l > 0.1 && c.l < 0.94,
  violet: (c) => c.s >= 0.12 && c.h >= 255 && c.h < 300 && c.l > 0.1 && c.l < 0.94,
};

export function hexVersRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbVersHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("").toUpperCase();
}
export function hsl(hex: string): Hsl {
  const [r, g, b] = hexVersRgb(hex).map((x) => x / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return { h, s, l };
}
function hslVersHex({ h, s, l }: Hsl) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbVersHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
const lum = (hex: string) => {
  const [r, g, b] = hexVersRgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function contraste(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** Assombrit (ou éclaircit) la couleur de texte jusqu'à un contraste ≥ 4,5 avec le fond. */
export function ajusterTexte(texte: string, fond: string) {
  if (contraste(texte, fond) >= 4.5) return texte;
  const c = hsl(texte);
  const fondClair = lum(fond) > 0.18;
  for (let i = 0; i < 100; i++) {
    c.l = Math.max(0, Math.min(1, c.l + (fondClair ? -0.01 : 0.01)));
    const h = hslVersHex(c);
    if (contraste(h, fond) >= 4.5) return h;
  }
  return fondClair ? "#1A1A1A" : "#FFFFFF";
}
export const famillesDe = (hex: string) => Object.entries(FAMILLES).filter(([, t]) => t(hsl(hex))).map(([k]) => k);

/** Ramène une couleur interdite vers un neutre de même luminosité (gris chaud). */
function neutraliser(hex: string) {
  const c = hsl(hex);
  return hslVersHex({ h: 35, s: 0.08, l: c.l });
}

export type Police = { nom: string; categorie: string; usage: string; par_defaut: boolean };
export type Palette = { role: string; hex: string; nom: string }[];
export type Charte = { nom_style: string; mots_cles: string[]; palette: Palette; police_titre: string; police_texte: string; explication: string; idees: string[] };

/** Problèmes qui justifient un nouvel essai de l'IA. */
export function problemes(brut: unknown, polices: Police[], evitees: string[]): string[] {
  const p: string[] = [];
  const o = brut as Record<string, unknown>;
  if (!o || typeof o !== "object") return ["réponse non conforme"];
  const pal = Array.isArray(o.palette) ? o.palette as Record<string, unknown>[] : [];
  if (pal.length !== 5 || !pal.every((c) => typeof c?.hex === "string" && /^#[0-9A-Fa-f]{6}$/.test(c.hex as string))) p.push("la palette doit contenir exactement 5 couleurs #RRGGBB");
  if (!ROLES.every((r) => pal.some((c) => c?.role === r))) p.push("chaque rôle (principale, secondaire, accent, fond, texte) doit apparaître une fois");
  const titre = polices.find((x) => x.nom === o.police_titre);
  const texte = polices.find((x) => x.nom === o.police_texte);
  if (!titre) p.push(`police_titre « ${o.police_titre} » absente de la liste`);
  if (!texte) p.push(`police_texte « ${o.police_texte} » absente de la liste`);
  else if (texte.usage === "titre") p.push(`« ${texte.nom} » ne peut servir qu'aux titres`);
  for (const c of pal) {
    if (typeof c?.hex !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(c.hex)) continue;
    const f = famillesDe(c.hex).filter((x) => evitees.includes(x));
    if (f.length) p.push(`${c.hex} appartient à une couleur à éviter (${f.join(", ")})`);
  }
  return p;
}

/** Corrige ce qui reste après le nouvel essai : polices par défaut, couleurs interdites, contraste. */
export function corriger(brut: unknown, polices: Police[], evitees: string[]): { charte: Charte; corrections: string[] } {
  const o = brut as Record<string, unknown>;
  const corrections: string[] = [];
  const defaut = (cat: string, pourTexte: boolean) =>
    polices.find((x) => x.categorie === cat && x.par_defaut && (!pourTexte || x.usage !== "titre"))
    ?? polices.find((x) => x.nom === (pourTexte ? "Jost" : "Cormorant Garamond"))!;
  const brutPal = (Array.isArray(o.palette) ? o.palette : []) as Record<string, unknown>[];
  const neutres: Record<string, string> = { principale: "#A57D27", secondaire: "#C9B79C", accent: "#7A6A55", fond: "#FBF8F2", texte: "#2B2622" };
  const palette: Palette = ROLES.map((role) => {
    const c = brutPal.find((x) => x?.role === role);
    let hex = typeof c?.hex === "string" && /^#[0-9A-Fa-f]{6}$/.test(c.hex) ? c.hex.toUpperCase() : "";
    if (!hex) { hex = neutres[role]; corrections.push(`couleur ${role} manquante remplacée`); }
    if (famillesDe(hex).some((f) => evitees.includes(f))) { hex = neutraliser(hex); corrections.push(`couleur ${role} neutralisée (couleur à éviter)`); }
    return { role, hex, nom: String(c?.nom ?? "").slice(0, 40) || role };
  });
  const fond = palette.find((c) => c.role === "fond")!;
  const texte = palette.find((c) => c.role === "texte")!;
  const ajuste = ajusterTexte(texte.hex, fond.hex);
  if (ajuste !== texte.hex) { corrections.push(`texte ${texte.hex} → ${ajuste} (contraste)`); texte.hex = ajuste; }

  let titre = polices.find((x) => x.nom === o.police_titre);
  let ptexte = polices.find((x) => x.nom === o.police_texte);
  if (!titre) { titre = defaut("serif_elegant", false); corrections.push(`police titre → ${titre.nom}`); }
  if (!ptexte || ptexte.usage === "titre") {
    const cat = ptexte && ptexte.categorie !== "script" && ptexte.categorie !== "manuscrit_decontracte" ? ptexte.categorie : "sans_serif";
    ptexte = defaut(cat, true); corrections.push(`police texte → ${ptexte.nom}`);
  }
  const liste = (v: unknown, n: number, l: number) => (Array.isArray(v) ? v : []).filter((x) => typeof x === "string" && x.trim()).slice(0, n).map((x) => String(x).trim().slice(0, l));
  return {
    charte: {
      nom_style: String(o.nom_style ?? "").trim().slice(0, 60) || "Notre style",
      mots_cles: liste(o.mots_cles, 3, 30), palette, police_titre: titre.nom, police_texte: ptexte.nom,
      explication: String(o.explication ?? "").trim().slice(0, 500), idees: liste(o.idees, 5, 200),
    },
    corrections,
  };
}

const LIB: Record<string, Record<string, string>> = {
  nb_invites: { moins_30: "moins de 30", "30_60": "30 à 60", "60_100": "60 à 100", "100_150": "100 à 150", plus_150: "plus de 150" },
  budget_fourchette: { moins_10k: "moins de 10 000 €", "10_20k": "10 000 à 20 000 €", "20_30k": "20 000 à 30 000 €", "30_50k": "30 000 à 50 000 €", plus_50k: "plus de 50 000 €", inconnu: "pas encore défini" },
};
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const FORMALITE = ["", "décontracté", "plutôt décontracté", "entre les deux", "habillé", "très habillé"];

/** Bloc court « Profil du couple » (10 lignes max), sans champ vide. */
// deno-lint-ignore no-explicit-any
export function blocProfil(p: any, nomStyle?: string | null): string {
  if (!p && !nomStyle) return "";
  const l: string[] = [];
  if (p?.date_mariage) l.push(`Date : ${new Date(p.date_mariage + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`);
  else if (p?.date_mois && p?.date_annee) l.push(`Date : ${MOIS[p.date_mois - 1]} ${p.date_annee} (jour non fixé)`);
  if (p?.lieu_libelle) l.push(`Lieu : ${p.lieu_libelle}${p.departements?.length ? ` (départements ${p.departements.slice(0, 15).join(", ")})` : ""}`);
  if (p?.nb_invites) l.push(`Invités : ${LIB.nb_invites[p.nb_invites] ?? p.nb_invites}`);
  if (p?.budget_fourchette) l.push(`Budget global : ${LIB.budget_fourchette[p.budget_fourchette] ?? p.budget_fourchette}`);
  if (p?.types_ceremonie?.length) l.push(`Cérémonie : ${p.types_ceremonie.join(", ")}`);
  const style = [p?.ambiances?.length ? p.ambiances.join(", ") : "", p?.cadre ? `cadre ${p.cadre}` : ""].filter(Boolean).join(" ; ");
  if (style) l.push(`Ambiances : ${style}`);
  const coul = [p?.couleurs_aimees?.length ? `aimées ${p.couleurs_aimees.join(", ")}` : "", p?.couleurs_evitees?.length ? `à éviter ${p.couleurs_evitees.join(", ")}` : ""].filter(Boolean).join(" ; ");
  if (coul) l.push(`Couleurs : ${coul}`);
  const mat = [p?.matieres?.length ? p.matieres.join(", ") : "", p?.formalite ? `tenue ${FORMALITE[p.formalite]}` : ""].filter(Boolean).join(" ; ");
  if (mat) l.push(`Matières : ${mat}`);
  if (nomStyle) l.push(`Style de leur charte : ${nomStyle}`);
  if (p?.description_libre) l.push(`En une phrase : ${String(p.description_libre).slice(0, 200)}`);
  return l.slice(0, 10).join("\n");
}

/** Nettoie la réponse de l'analyse de photo. */
export function nettoyerVision(brut: unknown) {
  const o = (brut ?? {}) as Record<string, unknown>;
  const liste = (v: unknown, n: number) => (Array.isArray(v) ? v : []).filter((x) => typeof x === "string" && x.trim()).slice(0, n).map((x) => String(x).trim().slice(0, 60));
  return {
    ambiances: liste(o.ambiances, 3).filter((a) => AMBIANCES.includes(a)),
    matieres: liste(o.matieres, 8),
    elements: liste(o.elements, 8),
    description: String(o.description ?? "").trim().slice(0, 300) || "Photo sans élément de décoration identifiable",
  };
}
