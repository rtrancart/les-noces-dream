// Atelier – monogramme : assemblage SVG dans le navigateur, sans IA.
// Les lettres sont toujours converties en tracés (opentype.js + fichiers TTF du bucket « polices ») :
// l'aperçu et l'export SVG/PNG sont identiques et s'affichent partout sans la police installée.
import opentype from "opentype.js";
import { urlPoliceTtf, type Police } from "@/lib/notreStyle";

export const DISPOSITIONS = [
  { id: "cote_a_cote", nom: "Côte à côte" },
  { id: "superposees", nom: "Superposées" },
  { id: "trait_vertical", nom: "Trait vertical" },
  { id: "cercle", nom: "Dans un cercle" },
  { id: "double_cercle", nom: "Dans un double cercle" },
  { id: "losange", nom: "Dans un losange" },
  { id: "avec_date", nom: "Avec la date" },
  { id: "en_arc", nom: "En arc" },
] as const;
export type DispositionId = typeof DISPOSITIONS[number]["id"];

/** Cadre imposé par certaines dispositions ; les autres acceptent un ornement libre. */
const CADRE_IMPOSE: Partial<Record<DispositionId, string>> = { cercle: "cercle_fin", double_cercle: "double_cercle", losange: "losange" };
const ORNEMENTS_LIBRES = ["aucun", "couronne_laurier", "branche_feuillage", "cadre_art_deco", "filets_horizontaux"];
/** Affinités des familles de polices avec les ambiances (sert seulement à l'ordre des propositions). */
const AMBIANCES_POLICE: Record<string, string[]> = {
  script: ["Romantique", "Bohème", "Champêtre", "Glamour", "Vintage / rétro", "Nature / forêt", "Bord de mer", "Tropical / exotique"],
  capitales_classiques: ["Chic / classique", "Art déco", "Baroque", "Minimaliste", "Moderne / contemporain", "Sobre / corporate", "Industriel", "Méditerranéen"],
};
const POLICE_DATE = "Tenor Sans";

export type Ornement = { id: string; nom: string; ambiances: string[] };
export type Proposition = { disposition: DispositionId; ornement: string; police: string };

// ── Ornements dessinés en code (viewBox 0 0 400 400) ──
const r2 = (n: number) => Math.round(n * 100) / 100;
function feuille(x: number, y: number, angle: number, l = 22, e = 8) {
  return `<ellipse cx="${r2(x)}" cy="${r2(y)}" rx="${l / 2}" ry="${e / 2}" transform="rotate(${r2(angle)} ${r2(x)} ${r2(y)})"/>`;
}
export function dessinerOrnement(id: string, c: string): string {
  const trait = `fill="none" stroke="${c}"`;
  switch (id) {
    case "cercle_fin": return `<circle cx="200" cy="200" r="160" ${trait} stroke-width="2.5"/>`;
    case "double_cercle": return `<circle cx="200" cy="200" r="165" ${trait} stroke-width="3"/><circle cx="200" cy="200" r="152" ${trait} stroke-width="1.2"/>`;
    case "losange": return `<polygon points="200,30 370,200 200,370 30,200" ${trait} stroke-width="2.5" stroke-linejoin="round"/><polygon points="200,48 352,200 200,352 48,200" ${trait} stroke-width="1"/>`;
    case "couronne_laurier": {
      let f = "";
      for (let i = 0; i < 9; i++) {
        const g = (100 + i * 15) * Math.PI / 180, d = (80 - i * 15) * Math.PI / 180;
        f += feuille(200 + 160 * Math.cos(g), 200 + 160 * Math.sin(g), (g * 180) / Math.PI + 90 + 28, 26, 9);
        f += feuille(200 + 160 * Math.cos(d), 200 + 160 * Math.sin(d), (d * 180) / Math.PI - 90 - 28, 26, 9);
      }
      return `<path d="M 200 360 m -150 -80 A 160 160 0 0 0 200 360 A 160 160 0 0 0 350 280" ${trait} stroke-width="1.5"/><g fill="${c}">${f}</g>`;
    }
    case "branche_feuillage": {
      let f = "";
      for (let i = 0; i < 7; i++) {
        const x = 110 + i * 30, y = 330 - Math.sin((i / 6) * Math.PI) * 10;
        f += feuille(x, y - 9, -35, 22, 8) + feuille(x + 12, y + 9, 35, 22, 8);
      }
      return `<path d="M 95 330 Q 200 312 315 330" ${trait} stroke-width="2"/><g fill="${c}">${f}</g>`;
    }
    case "cadre_art_deco": return `<path d="M 70 50 H 330 V 80 H 350 V 320 H 330 V 350 H 70 V 320 H 50 V 80 H 70 Z" ${trait} stroke-width="2.5"/>`
      + `<path d="M 82 64 H 318 V 336 H 82 Z" ${trait} stroke-width="1"/>`
      + Array.from({ length: 7 }, (_, i) => { const a = (-150 + i * 20) * Math.PI / 180; return `<line x1="${r2(200 + 20 * Math.cos(a))}" y1="${r2(64 + 20 * Math.sin(a) + 20)}" x2="${r2(200 + 44 * Math.cos(a))}" y2="${r2(64 + 44 * Math.sin(a) + 20)}" stroke="${c}" stroke-width="1.5"/>`; }).join("");
    case "filets_horizontaux": return `<line x1="70" y1="95" x2="330" y2="95" stroke="${c}" stroke-width="1.5"/><line x1="70" y1="305" x2="330" y2="305" stroke="${c}" stroke-width="1.5"/>`
      + `<polygon points="200,87 208,95 200,103 192,95" fill="${c}"/><polygon points="200,297 208,305 200,313 192,305" fill="${c}"/>`;
    default: return "";
  }
}

// ── Polices TTF (cache) ──
const cache = new Map<string, Promise<opentype.Font>>();
export function chargerTtf(p: Police): Promise<opentype.Font> {
  if (!p.fichier_ttf) return Promise.reject(new Error(`Pas de fichier TTF pour ${p.nom}`));
  if (!cache.has(p.nom)) {
    cache.set(p.nom, fetch(urlPoliceTtf(p.fichier_ttf)).then((r) => { if (!r.ok) throw new Error(`Police ${p.nom} indisponible`); return r.arrayBuffer(); })
      .then((b) => opentype.parse(b)).catch((e) => { cache.delete(p.nom); throw e; }));
  }
  return cache.get(p.nom)!;
}

/** Tracé d'un texte centré sur (cx, cy) d'après sa boîte englobante exacte, à hauteur visuelle `h`. */
function texteCentre(font: opentype.Font, texte: string, cx: number, cy: number, h: number, couleur: string, opts: { espacement?: number; refHauteur?: string } = {}) {
  // Taille réglée pour que la hauteur visuelle des majuscules vaille h (les scripts ont des proportions très variables)
  const ref = font.getPath(opts.refHauteur ?? "H", 0, 0, 100).getBoundingBox();
  const taille = (h / Math.max(1, ref.y2 - ref.y1)) * 100;
  let d = "", xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  const chemins: opentype.Path[] = [];
  if (opts.espacement) {
    let x = 0;
    for (const ch of texte) { const p = font.getPath(ch, x, 0, taille); chemins.push(p); x += font.getAdvanceWidth(ch, taille) + opts.espacement; }
  } else chemins.push(font.getPath(texte, 0, 0, taille));
  for (const p of chemins) { const b = p.getBoundingBox(); if (b.x1 < xmin) xmin = b.x1; if (b.x2 > xmax) xmax = b.x2; if (b.y1 < ymin) ymin = b.y1; if (b.y2 > ymax) ymax = b.y2; }
  if (!isFinite(xmin)) return "";
  const dx = cx - (xmin + xmax) / 2, dy = cy - (ymin + ymax) / 2;
  for (const p of chemins) d += decaler(p, dx, dy).toPathData(2);
  return `<path d="${d}" fill="${couleur}"/>`;
}
function decaler(p: opentype.Path, dx: number, dy: number) {
  const q = new opentype.Path();
  for (const c of p.commands) {
    const n = { ...c } as Record<string, number | string>;
    for (const k of ["x", "x1", "x2"]) if (typeof n[k] === "number") n[k] = (n[k] as number) + dx;
    for (const k of ["y", "y1", "y2"]) if (typeof n[k] === "number") n[k] = (n[k] as number) + dy;
    q.commands.push(n as unknown as opentype.PathCommand);
  }
  return q;
}
/** Texte posé sur un arc de cercle (lettres une à une, tangentes au cercle). */
function texteArc(font: opentype.Font, texte: string, rayon: number, taille: number, couleur: string, haut: boolean) {
  const largeurs = [...texte].map((ch) => font.getAdvanceWidth(ch, taille) + taille * 0.12);
  const total = largeurs.reduce((s, w) => s + w, 0);
  let a = -total / rayon / 2, out = "";
  [...texte].forEach((ch, i) => {
    const mid = a + largeurs[i] / 2 / rayon;
    const ang = haut ? mid : -mid;
    const x = 200 + rayon * Math.sin(ang), y = 200 + (haut ? -1 : 1) * rayon * Math.cos(ang);
    const p = font.getPath(ch, -font.getAdvanceWidth(ch, taille) / 2, haut ? 0 : taille * 0.7, taille);
    out += `<path d="${p.toPathData(2)}" fill="${couleur}" transform="translate(${r2(x)} ${r2(y)}) rotate(${r2((ang * 180) / Math.PI)})"/>`;
    a += largeurs[i] / rayon;
  });
  return out;
}

export type Rendu = { disposition: DispositionId; ornement: string; police: Police; initiales: [string, string]; date?: string | null; couleurLettres: string; couleurOrnement: string };

/** SVG final (fond transparent), lettres en tracés. */
export async function rendreSvg(r: Rendu, polices: Police[], taillePx?: number): Promise<string> {
  const font = await chargerTtf(r.police);
  const pDate = polices.find((p) => p.nom === POLICE_DATE) ?? r.police;
  const fDate = await chargerTtf(pDate).catch(() => font);
  const [a, b] = r.initiales.map((x) => (x || "").trim().slice(0, 1).toUpperCase() || "·");
  const L = r.couleurLettres, O = r.couleurOrnement;
  const cadre = CADRE_IMPOSE[r.disposition] ?? r.ornement;
  const encadre = !!CADRE_IMPOSE[r.disposition] || cadre === "cadre_art_deco" || cadre === "couronne_laurier";
  const h = encadre ? 92 : 120;
  let corps = "";
  switch (r.disposition) {
    case "superposees":
      corps = texteCentre(font, a, 165, 172, h * 1.05, L) + texteCentre(font, b, 238, 236, h * 1.05, L); break;
    case "trait_vertical":
      corps = texteCentre(font, a, 135, 200, h, L) + texteCentre(font, b, 265, 200, h, L)
        + `<line x1="200" y1="${200 - h * 0.75}" x2="200" y2="${200 + h * 0.75}" stroke="${O}" stroke-width="2"/>`; break;
    case "avec_date":
      corps = texteCentre(font, a, 140, 178, h * 0.9, L) + texteCentre(font, "&", 200, 190, h * 0.45, O) + texteCentre(font, b, 260, 178, h * 0.9, L)
        + texteCentre(fDate, (r.date || "").toUpperCase() || "NOTRE MARIAGE", 200, 268, 15, L, { espacement: 5 }); break;
    case "en_arc":
      corps = texteCentre(font, a, 155, 205, h * 0.85, L) + texteCentre(font, b, 245, 205, h * 0.85, L)
        + texteArc(fDate, (r.date || "NOTRE MARIAGE").toUpperCase(), 128, 20, L, true)
        + `<circle cx="200" cy="200" r="3" fill="${O}" transform="translate(0 ${135})"/>`; break;
    default: // cote_a_cote, cercle, double_cercle, losange
      corps = texteCentre(font, a, encadre ? 140 : 128, 200, h, L) + texteCentre(font, "&", 200, 208, h * 0.45, O) + texteCentre(font, b, encadre ? 260 : 272, 200, h, L);
  }
  const orn = r.disposition === "en_arc" && cadre === "couronne_laurier" ? "" : dessinerOrnement(cadre, O);
  const dim = taillePx ? ` width="${taillePx}" height="${taillePx}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"${dim}>${orn}${corps}</svg>`;
}

export async function svgVersPng(svg: string, taille = 2000): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg.replace("<svg ", `<svg width="${taille}" height="${taille}" `)], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((ok, ko) => { img.onload = () => ok(); img.onerror = () => ko(new Error("Conversion impossible")); img.src = url; });
    const c = document.createElement("canvas"); c.width = taille; c.height = taille;
    c.getContext("2d")!.drawImage(img, 0, 0, taille, taille); // fond transparent
    const b: Blob | null = await new Promise((r) => c.toBlob(r, "image/png"));
    if (!b) throw new Error("Conversion impossible");
    return b;
  } finally { URL.revokeObjectURL(url); }
}

// ── Propositions ──
function alea(graine: number) { let s = graine >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
export const cleProposition = (p: Proposition) => `${p.disposition}|${p.ornement}|${p.police}`;

/** 12 combinaisons : d'abord celles dont police et ornement correspondent aux ambiances du couple. */
export function proposer(polices: Police[], ornements: Ornement[], ambiances: string[], graine: number, dejaVues: Set<string>, n = 12): Proposition[] {
  const rnd = alea(graine);
  const pol = polices.filter((p) => p.fichier_ttf && (p.categorie === "script" || p.categorie === "capitales_classiques"));
  const orn = new Map(ornements.map((o) => [o.id, o]));
  const cand: (Proposition & { score: number; r: number })[] = [];
  for (const d of DISPOSITIONS) {
    const ornIds = CADRE_IMPOSE[d.id] ? [CADRE_IMPOSE[d.id]!] : ORNEMENTS_LIBRES.filter((o) => orn.has(o));
    for (const o of ornIds) for (const p of pol) {
      const prop = { disposition: d.id, ornement: o, police: p.nom };
      if (dejaVues.has(cleProposition(prop))) continue;
      const sp = (AMBIANCES_POLICE[p.categorie] ?? []).some((x) => ambiances.includes(x)) ? 1 : 0;
      const so = (orn.get(o)?.ambiances ?? []).some((x) => ambiances.includes(x)) ? 1 : 0;
      cand.push({ ...prop, score: sp + so, r: rnd() });
    }
  }
  cand.sort((x, y) => y.score - x.score || x.r - y.r);
  // Variété : au plus 2 fois la même disposition et la même police
  const out: Proposition[] = [], nd = new Map<string, number>(), np = new Map<string, number>();
  for (const c of cand) {
    if ((nd.get(c.disposition) ?? 0) >= 2 || (np.get(c.police) ?? 0) >= 2) continue;
    out.push({ disposition: c.disposition, ornement: c.ornement, police: c.police });
    nd.set(c.disposition, (nd.get(c.disposition) ?? 0) + 1); np.set(c.police, (np.get(c.police) ?? 0) + 1);
    if (out.length >= n) break;
  }
  for (const c of cand) { if (out.length >= n) break; if (!out.some((o) => cleProposition(o) === cleProposition(c))) out.push(c); }
  return out;
}
