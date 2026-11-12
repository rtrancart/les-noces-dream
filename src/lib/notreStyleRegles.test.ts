import { describe, expect, it } from "vitest";
import { analyserSvg, detecterFormat, retirerMetadonnees } from "../../supabase/functions/upload-asset/fichier";
import { contraste, corriger, famillesDe, problemes, PASTILLES as PASTILLES_SERVEUR, type Police } from "../../supabase/functions/ai-gateway/charte";
import { PASTILLES } from "./notreStyle";

const octets = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
const texte = (s: string) => new TextEncoder().encode(s);

describe("upload-asset : format réel d'après le contenu", () => {
  it("reconnaît un JPEG même sans extension", () => expect(detecterFormat(octets(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg"));
  it("signale un HEIC d'iPhone", () => expect(detecterFormat(texte("\0\0\0\x18ftypheic\0\0\0\0mif1"))).toBe("image/heic"));
  it("refuse un exécutable renommé en .jpg", () => expect(detecterFormat(texte("MZ\x90\0\x03\0\0\0\x04\0\0\0"))).toBeNull());
});

describe("upload-asset : nettoyage SVG", () => {
  it("retire script, onload et lien externe", () => {
    const r = analyserSvg('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><a href="https://x.io"><circle r="4"/></a></svg>');
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.svg).not.toMatch(/script|onload|https:/); expect(r.svg).toContain("<circle"); }
  });
  it("refuse un SVG avec DOCTYPE/ENTITY", () => expect(analyserSvg('<!DOCTYPE svg [<!ENTITY x "y">]><svg></svg>').ok).toBe(false));
  it("refuse javascript: caché dans un attribut", () => expect(analyserSvg('<svg><image src="javascript:alert(1)"/></svg>').ok).toBe(false));
});

describe("upload-asset : métadonnées", () => {
  it("supprime le segment EXIF (GPS) d'un JPEG", () => {
    const exif = [0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
    const jpg = new Uint8Array([0xff, 0xd8, ...exif, 0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]);
    const out = retirerMetadonnees(jpg, "image/jpeg");
    expect(Array.from(out)).toEqual([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]);
  });
});

const POLICES: Police[] = [
  { nom: "Cormorant Garamond", categorie: "serif_elegant", usage: "les_deux", par_defaut: true },
  { nom: "Great Vibes", categorie: "script", usage: "titre", par_defaut: true },
  { nom: "Jost", categorie: "sans_serif", usage: "les_deux", par_defaut: true },
];
const brut = (pal: string[], titre = "Great Vibes", txt = "Jost") => ({
  nom_style: "Test", palette: ["principale", "secondaire", "accent", "fond", "texte"].map((role, i) => ({ role, hex: pal[i], nom: role })),
  police_titre: titre, police_texte: txt,
});

describe("charte : contrôles côté code", () => {
  it("détecte une police hors bibliothèque", () => expect(problemes(brut(["#A57D27", "#C9B79C", "#7A6A55", "#FBF8F2", "#2B2622"], "Comic Sans"), POLICES, []).length).toBe(1));
  it("une police script ne peut pas servir au texte", () => {
    const { charte } = corriger(brut(["#A57D27", "#C9B79C", "#7A6A55", "#FBF8F2", "#2B2622"], "Great Vibes", "Great Vibes"), POLICES, []);
    expect(charte.police_texte).toBe("Jost");
  });
  it("aucun vert quand le vert est à éviter", () => {
    const { charte } = corriger(brut(["#9CAF88", "#3E7C4A", "#7A6A55", "#FBF8F2", "#2B2622"]), POLICES, ["vert"]);
    expect(charte.palette.some((c) => famillesDe(c.hex).includes("vert"))).toBe(false);
  });
  it("contraste texte/fond ramené à 4,5 minimum", () => {
    const { charte } = corriger(brut(["#A57D27", "#C9B79C", "#7A6A55", "#FBF8F2", "#C8C0B0"]), POLICES, []);
    const f = charte.palette.find((c) => c.role === "fond")!.hex, t = charte.palette.find((c) => c.role === "texte")!.hex;
    expect(contraste(t, f)).toBeGreaterThanOrEqual(4.5);
  });
  it("les pastilles du navigateur et du serveur sont identiques", () => expect(PASTILLES).toEqual(PASTILLES_SERVEUR));
});
