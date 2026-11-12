// Atelier – « Notre style » : listes partagées, types, appels serveur et calculs de couleur (sans IA).
import { supabase } from "@/integrations/supabase/client";
import { ErreurAtelier } from "@/lib/atelier";

export const AMBIANCES = ["Champêtre", "Bohème", "Romantique", "Chic / classique", "Minimaliste", "Moderne / contemporain",
  "Vintage / rétro", "Baroque", "Art déco", "Industriel", "Méditerranéen", "Tropical / exotique", "Nature / forêt",
  "Bord de mer", "Glamour", "Sobre / corporate"] as const;

/** Aplats de couleurs des vignettes d'ambiance (aucune image récupérée sur internet). */
export const APLATS_AMBIANCE: Record<string, [string, string, string]> = {
  "Champêtre": ["#E9DFC6", "#C8B27A", "#8A9A5B"], "Bohème": ["#EFE2D3", "#D4B59A", "#B07A5A"],
  "Romantique": ["#F6E6E4", "#E8C4C4", "#C98F95"], "Chic / classique": ["#F4F1EA", "#D8CFC0", "#2F3A4A"],
  "Minimaliste": ["#F7F7F5", "#E4E3DF", "#2B2B2B"], "Moderne / contemporain": ["#EDEDED", "#B9BEC4", "#1F2328"],
  "Vintage / rétro": ["#EFE3CF", "#D9A86C", "#7A5236"], "Baroque": ["#3B1D2A", "#8C2F39", "#C9A24B"],
  "Art déco": ["#1C1C1C", "#C9A24B", "#E9DCC0"], "Industriel": ["#D9D6D2", "#8A8580", "#3E3A37"],
  "Méditerranéen": ["#F5EEDF", "#E1B97A", "#2E6C8E"], "Tropical / exotique": ["#F3E9D2", "#E58A3A", "#2F7D5B"],
  "Nature / forêt": ["#E7EBDD", "#9CAF88", "#3E5A3A"], "Bord de mer": ["#EEF3F5", "#A9CBE3", "#2D5C7A"],
  "Glamour": ["#F3E6E8", "#C9A24B", "#5B2A3C"], "Sobre / corporate": ["#F2F2F2", "#9AA3AD", "#1F2F4D"],
};

export const CADRES = ["Campagne", "Bord de mer", "Montagne", "Ville", "Vignes", "Château", "Forêt"];
export const MATIERES = ["Lin", "Velours", "Bois", "Doré", "Argenté", "Fleurs séchées", "Bougies", "Verdure", "Dentelle", "Pierre"];
export const CEREMONIES = [{ id: "civile", label: "Civile" }, { id: "religieuse", label: "Religieuse" }, { id: "laique", label: "Laïque" }];
export const NB_INVITES = [
  { id: "moins_30", label: "Moins de 30" }, { id: "30_60", label: "30 à 60" }, { id: "60_100", label: "60 à 100" },
  { id: "100_150", label: "100 à 150" }, { id: "plus_150", label: "Plus de 150" },
];
export const BUDGETS = [
  { id: "moins_10k", label: "Moins de 10 000 €" }, { id: "10_20k", label: "10 000 à 20 000 €" }, { id: "20_30k", label: "20 000 à 30 000 €" },
  { id: "30_50k", label: "30 000 à 50 000 €" }, { id: "plus_50k", label: "Plus de 50 000 €" }, { id: "inconnu", label: "Je ne sais pas encore" },
];
export const FORMALITE = ["", "Décontracté", "Plutôt décontracté", "Entre les deux", "Habillé", "Très habillé"];

/** Pastilles (copie identique dans supabase/functions/ai-gateway/charte.ts). */
export const PASTILLES: { id: string; label: string; hex: string; famille: string }[] = [
  { id: "blanc", label: "Blanc", hex: "#FFFFFF", famille: "blanc" },
  { id: "ivoire", label: "Ivoire", hex: "#F3EBDD", famille: "blanc" },
  { id: "gris", label: "Gris", hex: "#9A9A9A", famille: "gris" },
  { id: "noir", label: "Noir", hex: "#1C1C1C", famille: "noir" },
  { id: "dore", label: "Doré", hex: "#C9A24B", famille: "jaune" },
  { id: "jaune", label: "Jaune", hex: "#E9C84A", famille: "jaune" },
  { id: "orange", label: "Orange", hex: "#E58A3A", famille: "orange" },
  { id: "terracotta", label: "Terracotta", hex: "#C07A55", famille: "orange" },
  { id: "marron", label: "Marron", hex: "#6B4A33", famille: "marron" },
  { id: "rouge", label: "Rouge", hex: "#C0392B", famille: "rouge" },
  { id: "bordeaux", label: "Bordeaux", hex: "#6D1A2C", famille: "rouge" },
  { id: "rose_poudre", label: "Rose poudré", hex: "#E8C4C4", famille: "rose" },
  { id: "fuchsia", label: "Fuchsia", hex: "#C2337A", famille: "rose" },
  { id: "lavande", label: "Lavande", hex: "#B9A7D6", famille: "violet" },
  { id: "violet", label: "Violet", hex: "#6C3F8F", famille: "violet" },
  { id: "bleu_ciel", label: "Bleu ciel", hex: "#A9CBE3", famille: "bleu" },
  { id: "bleu_marine", label: "Bleu marine", hex: "#1F2F4D", famille: "bleu" },
  { id: "sauge", label: "Vert sauge", hex: "#9CAF88", famille: "vert" },
  { id: "vert", label: "Vert", hex: "#3E7C4A", famille: "vert" },
  { id: "olive", label: "Vert olive", hex: "#4F5A3A", famille: "vert" },
];

export type ProfilMariage = {
  user_id: string; date_mariage: string | null; date_mois: number | null; date_annee: number | null;
  lieu_libelle: string | null; lieu_type: "ville" | "departement" | "region" | null; lieu_code: string | null;
  departements: string[]; region: string | null; nb_invites: string | null; budget_fourchette: string | null;
  types_ceremonie: string[]; ambiances: string[]; cadre: string | null; couleurs_aimees: string[]; couleurs_evitees: string[];
  matieres: string[]; formalite: number | null; description_libre: string | null; questionnaire_termine_le: string | null;
};
export type CouleurCharte = { role: "principale" | "secondaire" | "accent" | "fond" | "texte"; hex: string; nom: string };
export type Monogramme = { disposition: string; ornement: string; police: string; initiales: [string, string] };
export type CharteMariage = {
  id: string; user_id: string; nom_style: string; mots_cles: string[]; palette: CouleurCharte[]; police_titre: string; police_texte: string;
  explication: string | null; idees: string[]; active: boolean; source: string; monogramme: Monogramme | null; logo_perso_url: string | null; created_at: string;
};
export type PhotoInspiration = {
  id: string; type: "inspiration" | "logo"; fichier_nom: string; storage_path: string; taille_octets: number; format: string;
  largeur: number | null; hauteur: number | null; couleurs_dominantes: string[];
  analyse_ia: { ambiances: string[]; matieres: string[]; elements: string[]; description: string } | null; created_at: string;
};
export type Police = { nom: string; categorie: string; usage: string; fichier_ttf: string | null; par_defaut: boolean };

export const ESPACE_MAX = 50 * 1024 * 1024;
export const FICHIER_MAX = 10 * 1024 * 1024;

async function lireCode(error: unknown) {
  const ctx = (error as { context?: Response }).context;
  try { const j = ctx ? await ctx.clone().json() : null; return { code: j?.error ?? "erreur", message: j?.message as string | undefined }; }
  catch {
    // Réponse non JSON : la protection du serveur a bloqué le fichier avant notre fonction (code caché dans un SVG, etc.).
    if (ctx?.status === 403) return { code: "fichier_bloque", message: "Ce fichier a été refusé par mesure de sécurité : il contient du code (script, entité…). Enregistrez-le à nouveau en SVG simple, ou envoyez-le en PNG." };
    return { code: "erreur", message: undefined };
  }
}

const MESSAGES_STYLE: Record<string, string> = {
  quota_atteint: "Vous avez utilisé toutes vos propositions. Vous pouvez toujours modifier votre charte à la main, sans limite.",
  mode_degrade: "Cette fonction est momentanément en pause. Vous pouvez modifier votre charte à la main en attendant.",
  budget_suspendu: "L'Atelier fait une courte pause. Revenez un peu plus tard, merci de votre patience.",
  usage_indisponible: "Cette fonction n'est pas encore disponible.",
  format_non_analysable: "Seules les photos JPG, PNG et WEBP peuvent être analysées.",
};

export class ErreurStyle extends Error {
  code: string;
  constructor(code: string, message?: string) { super(MESSAGES_STYLE[code] ?? message ?? new ErreurAtelier(code).message); this.code = code; }
}

async function passerelle<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ai-gateway", { body });
  if (error) { const e = await lireCode(error); throw new ErreurStyle(e.code, e.message); }
  return data as T;
}
export const genererCharte = () => passerelle<{ charte: CharteMariage; corrections: string[]; restants: number | null }>({ usage: "charte", donnees: {} });
export const analyserPhoto = (photo_id: string) => passerelle<{ analyse: PhotoInspiration["analyse_ia"]; restants: number | null }>({ usage: "vision", donnees: { photo_id } });
export const lireQuotasStyle = () => passerelle<{ charte: number | null; vision: number | null }>({ action: "quotas_style" });

/** Envoi via la fonction upload-asset (le navigateur n'écrit jamais dans le stockage). */
export async function envoyerFichier(f: Blob, nom: string, type: "inspiration" | "logo", meta: { largeur?: number; hauteur?: number; couleurs?: string[] } = {}) {
  const fd = new FormData();
  fd.append("fichier", f, nom);
  fd.append("type", type);
  if (meta.largeur) fd.append("largeur", String(meta.largeur));
  if (meta.hauteur) fd.append("hauteur", String(meta.hauteur));
  if (meta.couleurs) fd.append("couleurs", JSON.stringify(meta.couleurs));
  const { data, error } = await supabase.functions.invoke("upload-asset", { body: fd });
  if (error) {
    const e = await lireCode(error);
    // La protection du serveur bloque un SVG contenant du code avant notre fonction (réponse sans en-têtes CORS → erreur réseau).
    const svgBloque = e.code === "erreur" && /\.svg$/i.test(nom);
    throw new ErreurStyle(svgBloque ? "fichier_bloque" : e.code, svgBloque ? "Ce SVG a été refusé par mesure de sécurité : il contient du code (script, entité…). Enregistrez-le à nouveau en SVG simple, ou envoyez-le en PNG." : e.message ?? "L'envoi a échoué, réessayez.");
  }
  return data as { fichier: PhotoInspiration; espace_utilise: number; espace_max: number };
}

export async function urlsSignees(chemins: string[]): Promise<Record<string, string>> {
  if (!chemins.length) return {};
  const { data } = await supabase.storage.from("maries-assets").createSignedUrls(chemins, 3600);
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path!, d.signedUrl]));
}

export async function supprimerFichier(p: Pick<PhotoInspiration, "id" | "storage_path">) {
  const { error: e1 } = await supabase.storage.from("maries-assets").remove([p.storage_path]);
  if (e1) throw new Error("Suppression impossible, réessayez.");
  const { data, error } = await supabase.from("photos_inspiration").delete().eq("id", p.id).select("id");
  if (error || !data?.length) throw new Error("Suppression impossible, réessayez.");
}

// ── Polices Google Fonts ──
const chargees = new Set<string>();
export function chargerPolice(nom: string) {
  if (!nom || chargees.has(nom)) return;
  chargees.add(nom);
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(nom).replace(/%20/g, "+")}&display=swap`;
  document.head.appendChild(l);
}
export const urlPoliceTtf = (fichier: string) => supabase.storage.from("polices").getPublicUrl(fichier).data.publicUrl;

// ── Couleurs ──
export const hexValide = (h: string) => /^#[0-9A-Fa-f]{6}$/.test(h);
const rgb = (hex: string) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function contraste(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
export const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("").toUpperCase();

/** 5 couleurs dominantes d'une image (quantification k-moyennes sur un échantillon réduit, dans le navigateur). */
export function extraireCouleurs(source: CanvasImageSource, w: number, h: number, n = 5): string[] {
  const k = 64 / Math.max(w, h);
  const cw = Math.max(1, Math.round(w * Math.min(1, k))), ch = Math.max(1, Math.round(h * Math.min(1, k)));
  const c = document.createElement("canvas"); c.width = cw; c.height = ch;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, cw, ch);
  const d = ctx.getImageData(0, 0, cw, ch).data;
  const px: number[][] = [];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) px.push([d[i], d[i + 1], d[i + 2]]);
  if (!px.length) return [];
  // Initialisation déterministe : points espacés après tri par luminosité
  const tri = [...px].sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  let centres = Array.from({ length: n }, (_, i) => [...tri[Math.floor(((i + 0.5) / n) * tri.length)]]);
  let groupes: number[][][] = [];
  for (let it = 0; it < 12; it++) {
    groupes = centres.map(() => []);
    for (const p of px) {
      let best = 0, bd = Infinity;
      centres.forEach((cc, j) => { const dd = (p[0] - cc[0]) ** 2 + (p[1] - cc[1]) ** 2 + (p[2] - cc[2]) ** 2; if (dd < bd) { bd = dd; best = j; } });
      groupes[best].push(p);
    }
    centres = groupes.map((g, j) => g.length ? [0, 1, 2].map((ch2) => g.reduce((s, p) => s + p[ch2], 0) / g.length) : centres[j]);
  }
  return centres.map((cc, j) => ({ hex: toHex(cc[0], cc[1], cc[2]), poids: groupes[j].length }))
    .sort((a, b) => b.poids - a.poids).map((x) => x.hex).filter((v, i, a) => a.indexOf(v) === i);
}

/** Répartit 5 couleurs extraites sur les rôles : fond = la plus claire, texte = la plus foncée. */
export function versPalette(couleurs: string[], noms?: string[]): CouleurCharte[] {
  const c = [...couleurs]; while (c.length < 5) c.push(["#FBF8F2", "#2B2622", "#A57D27", "#C9B79C", "#7A6A55"][c.length]);
  const parLum = [...c.slice(0, 5)].sort((a, b) => lum(b) - lum(a));
  const fond = parLum[0], texte = parLum[4], reste = parLum.slice(1, 4);
  const roles: CouleurCharte["role"][] = ["principale", "secondaire", "accent"];
  return [
    ...reste.map((hex, i) => ({ role: roles[i], hex, nom: noms?.[i] ?? roles[i] })),
    { role: "fond", hex: fond, nom: "Fond" }, { role: "texte", hex: texte, nom: "Texte" },
  ];
}

/** Redimensionne (1 568 px max) et réencode l'image : les métadonnées (GPS, appareil) disparaissent. */
export async function preparerImage(f: File): Promise<{ blob: Blob; nom: string; largeur: number; hauteur: number; couleurs: string[] }> {
  const estHeic = /\.(heic|heif)$/i.test(f.name) || /heic|heif/i.test(f.type);
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(f); }
  catch {
    throw new Error(estHeic
      ? "Les photos HEIC de l'iPhone ne peuvent pas être lues par ce navigateur. Sur l'iPhone, choisissez Réglages › Appareil photo › Formats › « Le plus compatible », ou envoyez une capture d'écran de la photo."
      : "Cette image n'a pas pu être lue. Envoyez une photo JPG, PNG ou WEBP.");
  }
  const k = Math.min(1, 1568 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  const couleurs = extraireCouleurs(bmp, bmp.width, bmp.height);
  bmp.close();
  const png = f.type === "image/png";
  const type = png ? "image/png" : "image/jpeg";
  const blob: Blob | null = await new Promise((r) => c.toBlob(r, type, 0.88));
  if (!blob) throw new Error("Cette image n'a pas pu être préparée.");
  const nom = f.name.replace(/\.[^.]+$/, "") + (png ? ".png" : ".jpg");
  return { blob, nom, largeur: w, hauteur: h, couleurs };
}

export const formaterTaille = (o: number) => o >= 1024 * 1024 ? `${(o / 1024 / 1024).toFixed(1).replace(".", ",")} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`;
