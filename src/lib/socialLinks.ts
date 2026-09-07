/**
 * Normalisation des liens réseaux sociaux.
 *
 * Les colonnes `url_tiktok` / `url_instagram` / `url_facebook` / `url_pinterest`
 * portent des contraintes CHECK en base :
 *   - tiktok    : https://www.tiktok.com/…
 *   - instagram : https://www.instagram.com/…
 *   - facebook  : https://www.facebook.com/…
 *   - pinterest : https://www.pinterest.com/… (ou pinterest.com / fr.pinterest.com)
 *
 * La normalisation doit donc TOUJOURS produire la forme canonique `www.`,
 * sinon l'enregistrement est rejeté silencieusement côté base.
 */

export type ReseauSocial = "tiktok" | "instagram" | "facebook" | "pinterest";

export const RESEAUX: ReseauSocial[] = ["tiktok", "instagram", "facebook", "pinterest"];

export const RESEAU_LABELS: Record<ReseauSocial, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  pinterest: "Pinterest",
};

export const RESEAU_COLONNES: Record<ReseauSocial, string> = {
  tiktok: "url_tiktok",
  instagram: "url_instagram",
  facebook: "url_facebook",
  pinterest: "url_pinterest",
};

const BASE: Record<ReseauSocial, string> = {
  tiktok: "https://www.tiktok.com/",
  instagram: "https://www.instagram.com/",
  facebook: "https://www.facebook.com/",
  pinterest: "https://www.pinterest.com/",
};

const HOSTS: Record<ReseauSocial, string[]> = {
  tiktok: ["tiktok.com", "www.tiktok.com", "vm.tiktok.com", "m.tiktok.com"],
  instagram: ["instagram.com", "www.instagram.com", "m.instagram.com"],
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.com", "www.fb.com"],
  pinterest: [
    "pinterest.com",
    "www.pinterest.com",
    "fr.pinterest.com",
    "pinterest.fr",
    "www.pinterest.fr",
  ],
};

export const RESEAU_PLACEHOLDERS: Record<ReseauSocial, string> = {
  tiktok: "@moncompte ou https://www.tiktok.com/@moncompte",
  instagram: "@moncompte ou https://www.instagram.com/moncompte",
  facebook: "mapage ou https://www.facebook.com/mapage",
  pinterest: "moncompte ou https://www.pinterest.com/moncompte",
};

export type NormalisationResultat = {
  ok: boolean;
  value?: string | null;
  error?: string;
};

/** Nettoie un identifiant : retire @, espaces, slashs et paramètres de suivi. */
function cleanHandle(raw: string): string {
  return raw.replace(/^@+/, "").replace(/^\/+|\/+$/g, "").trim();
}

/**
 * Transforme une saisie libre (@handle, url partielle, url complète) en URL
 * canonique acceptée par la base. Renvoie `null` si la saisie est vide.
 */
export function normaliserLienSocial(reseau: ReseauSocial, input: string): NormalisationResultat {
  const raw = (input ?? "").trim();
  if (raw === "") return { ok: true, value: null };

  const base = BASE[reseau];

  // Cas 1 : identifiant seul (pas de point ni de slash structurant)
  if (!raw.includes("/") && !/\b[a-z0-9-]+\.[a-z]{2,}\b/i.test(raw)) {
    const handle = cleanHandle(raw);
    if (!handle) return { ok: false, error: "Identifiant invalide." };
    if (!/^[A-Za-z0-9._-]+$/.test(handle)) {
      return { ok: false, error: "Identifiant invalide (lettres, chiffres, . _ - uniquement)." };
    }
    return { ok: true, value: base + (reseau === "tiktok" ? "@" : "") + handle };
  }

  // Cas 2 : URL (éventuellement sans protocole)
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return { ok: false, error: "Adresse invalide." };
  }

  const host = url.hostname.toLowerCase();
  if (!HOSTS[reseau].includes(host)) {
    return { ok: false, error: `Cette adresse n'est pas un lien ${RESEAU_LABELS[reseau]}.` };
  }

  const path = url.pathname.replace(/^\/+|\/+$/g, "");
  if (!path) {
    return { ok: false, error: "Indiquez l'adresse de votre profil, pas seulement le site." };
  }

  return { ok: true, value: `${base}${path}` };
}

/** Libellé lisible affiché sur la fiche publique (ex. @moncompte). */
export function libelleLienSocial(reseau: ReseauSocial, url: string): string {
  try {
    const path = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
    return path ? (path.startsWith("@") ? path : `@${path}`) : RESEAU_LABELS[reseau];
  } catch {
    return RESEAU_LABELS[reseau];
  }
}
