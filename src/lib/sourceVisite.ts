/**
 * Source de la visite (premier contact de la session, jamais écrasée).
 * sessionStorage + copie localStorage 30 min pour les nouveaux onglets
 * (clic-molette / Ctrl+clic ne recopient pas toujours le sessionStorage).
 * Aucune valeur de gclid stockée, referrer réduit au domaine.
 */
export interface SourceVisite {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer_domaine: string | null;
  gclid_present: boolean;
}

const CLE = "lesnoces_source_visite";
const TTL_MS = 30 * 60 * 1000;

const nettoyer = (v: string | null) => {
  const t = (v ?? "").trim().toLowerCase().slice(0, 100);
  return t === "" ? null : t;
};

export function extraireSource(url: string, referrer: string, hoteCourant: string): SourceVisite {
  const u = new URL(url);
  let domaine: string | null = null;
  try {
    if (referrer) {
      const h = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
      const courant = hoteCourant.toLowerCase().replace(/^www\./, "");
      domaine = h && h !== courant ? h : null;
    }
  } catch {
    domaine = null;
  }
  return {
    utm_source: nettoyer(u.searchParams.get("utm_source")),
    utm_medium: nettoyer(u.searchParams.get("utm_medium")),
    utm_campaign: nettoyer(u.searchParams.get("utm_campaign")),
    referrer_domaine: domaine,
    gclid_present: u.searchParams.has("gclid"),
  };
}

function lire(storage: Storage | undefined, avecTtl: boolean): SourceVisite | null {
  try {
    const raw = storage?.getItem(CLE);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (avecTtl && (typeof o.t !== "number" || Date.now() - o.t > TTL_MS)) return null;
    return o.s as SourceVisite;
  } catch {
    return null;
  }
}

function ecrire(storage: Storage | undefined, s: SourceVisite) {
  try {
    storage?.setItem(CLE, JSON.stringify({ s, t: Date.now() }));
  } catch {
    /* stockage indisponible */
  }
}

/** À appeler une fois au chargement de l'application. */
export function initialiserSourceVisite() {
  if (typeof window === "undefined") return;
  if (lire(window.sessionStorage, false)) return;
  const brute = extraireSource(window.location.href, document.referrer, window.location.hostname);
  const aUnSignal = brute.utm_source || brute.utm_medium || brute.referrer_domaine || brute.gclid_present;
  // Nouvel onglet sans signal propre : reprend la source récente de l'onglet d'origine.
  const s = aUnSignal ? brute : lire(window.localStorage, true) ?? brute;
  ecrire(window.sessionStorage, s);
  ecrire(window.localStorage, s);
}

export function obtenirSourceVisite(): SourceVisite | null {
  if (typeof window === "undefined") return null;
  return lire(window.sessionStorage, false);
}
