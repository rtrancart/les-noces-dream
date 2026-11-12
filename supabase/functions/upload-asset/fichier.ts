// Contrôles des fichiers envoyés : format réel d'après le contenu, nettoyage SVG, retrait des métadonnées.

export type Format = "image/jpeg" | "image/png" | "image/webp" | "image/svg+xml" | "image/heic";

const commence = (o: Uint8Array, sig: number[], decal = 0) => sig.every((b, i) => o[decal + i] === b);
const ascii = (o: Uint8Array, debut: number, fin: number) => String.fromCharCode(...o.slice(debut, fin));

/** Format d'après les premiers octets (l'extension et le type annoncé sont ignorés). */
export function detecterFormat(o: Uint8Array): Format | null {
  if (o.length < 12) return null;
  if (commence(o, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (commence(o, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(o, 0, 4) === "RIFF" && ascii(o, 8, 12) === "WEBP") return "image/webp";
  if (ascii(o, 4, 8) === "ftyp" && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|avif)$/.test(ascii(o, 8, 12))) return "image/heic";
  // SVG : texte UTF-8 dont la première balise est <svg (après déclaration XML / commentaires)
  const debut = new TextDecoder("utf-8", { fatal: false }).decode(o.slice(0, 2048)).replace(/^\uFEFF/, "");
  if (/^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(debut)) return "image/svg+xml";
  return null;
}

/** Nettoie un SVG : scripts, gestionnaires d'événements, liens externes. Refuse en cas de doute. */
export function analyserSvg(brut: string): { ok: true; svg: string } | { ok: false; motif: string } {
  const refus = (motif: string) => ({ ok: false as const, motif });
  if (/<!DOCTYPE|<!ENTITY/i.test(brut)) return refus("Ce SVG contient des déclarations non autorisées.");
  if (/<\?(?!xml\s)/i.test(brut)) return refus("Ce SVG contient des instructions non autorisées.");
  let s = brut.replace(/^\uFEFF/, "").replace(/<\?xml[^>]*\?>/i, "");
  // Éléments actifs ou embarquant du contenu externe : supprimés avec leur contenu
  for (const el of ["script", "foreignObject", "iframe", "embed", "object", "audio", "video", "canvas", "handler", "listener"]) {
    s = s.replace(new RegExp(`<${el}\\b[\\s\\S]*?<\\/${el}\\s*>`, "gi"), "").replace(new RegExp(`<${el}\\b[^>]*\\/?>`, "gi"), "");
  }
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  // Gestionnaires d'événements (onload, onclick…)
  s = s.replace(/\s+on[a-z-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Liens : seules les références internes (#id) sont conservées
  s = s.replace(/\s+(xlink:)?href\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (m, _x, v) => /^["']?\s*#/.test(v) ? m : "");
  // Styles : aucun appel externe
  s = s.replace(/url\(\s*(['"]?)(?!#)[^)]*\)/gi, "none").replace(/@import[^;]*;?/gi, "");
  // Animations qui pourraient réécrire un lien
  s = s.replace(/<(set|animate)\b[^>]*attributeName\s*=\s*["']?(xlink:)?href[^>]*\/?>/gi, "");
  // Contrôle final : en cas de doute, on refuse
  if (/<script|javascript:|vbscript:|data:text\/html|\son[a-z-]+\s*=|<foreignObject|<iframe|<embed|<object/i.test(s)) {
    return refus("Ce SVG contient du code et ne peut pas être accepté.");
  }
  if (!/^\s*<svg[\s>]/i.test(s.replace(/^\s*(<!--[\s\S]*?-->\s*)*/, ""))) return refus("Ce fichier n'est pas un SVG valide.");
  if (!/<\/svg>\s*$/i.test(s)) return refus("Ce fichier SVG est incomplet.");
  return { ok: true, svg: s.trim() };
}

/** Retire les métadonnées (EXIF : position GPS, appareil) des JPEG et PNG, en filet de sécurité. */
export function retirerMetadonnees(o: Uint8Array, format: Format): Uint8Array {
  try {
    if (format === "image/jpeg") {
      const parts: Uint8Array[] = [o.slice(0, 2)];
      let i = 2;
      while (i + 4 <= o.length && o[i] === 0xff) {
        const m = o[i + 1];
        if (m === 0xda) { parts.push(o.slice(i)); i = o.length; break; } // début des données image
        const len = (o[i + 2] << 8) | o[i + 3];
        const seg = o.slice(i, i + 2 + len);
        if (!(m === 0xe1 || m === 0xed || m === 0xfe)) parts.push(seg); // APP1 (Exif/XMP), APP13 (IPTC), commentaires
        i += 2 + len;
      }
      if (i < o.length) return o; // structure inattendue : on garde l'original plutôt que de le casser
      return concat(parts);
    }
    if (format === "image/png") {
      const parts: Uint8Array[] = [o.slice(0, 8)];
      let i = 8;
      while (i + 12 <= o.length) {
        const len = ((o[i] << 24) >>> 0) + (o[i + 1] << 16) + (o[i + 2] << 8) + o[i + 3];
        const type = ascii(o, i + 4, i + 8);
        const fin = i + 12 + len;
        if (fin > o.length) return o;
        if (!["eXIf", "tEXt", "iTXt", "zTXt", "tIME"].includes(type)) parts.push(o.slice(i, fin));
        i = fin;
        if (type === "IEND") break;
      }
      return concat(parts);
    }
  } catch { /* fichier atypique : inchangé */ }
  return o;
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let k = 0;
  for (const p of parts) { out.set(p, k); k += p.length; }
  return out;
}
