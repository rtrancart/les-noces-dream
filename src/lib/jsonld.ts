/**
 * JSON-LD builders for LesNoces.net (Phase 9).
 *
 * Pure functions that return schema.org-compliant objects. All URLs are
 * resolved to absolute via `resolveAbsoluteUrl()`. Conditional emission is
 * implemented inside each builder: callers pass the raw data, the builder
 * decides whether/how to emit properties.
 *
 * Render via the <JsonLd> component (uses react-helmet-async so Vercel's
 * prerenderer captures the script tag into the static HTML).
 */

import { resolveAbsoluteUrl } from "./seo";

const SITE_NAME = "LesNoces.net";
const SITE_URL = "https://lesnoces.net";

/* ───────────────────────── Category → @type heuristic ───────────────────── */

/**
 * Catégories mères dont les fiches désignent un établissement physique avec
 * adresse publique → `LocalBusiness`. Toute autre catégorie tombe sur
 * `ProfessionalService` (défaut sûr, n'exige pas d'adresse).
 *
 * Liste arrêtée à partir de l'audit base (parent_id IS NULL, est_active=true).
 */
export const LOCAL_BUSINESS_SLUGS = new Set<string>([
  "lieux-de-reception",
  "hebergements",
  "caviste-domaine-viticole",
]);

export interface ProviderAddressInput {
  ville?: string | null;
  adresse?: string | null;
  code_postal?: string | null;
}

/** Adresse exploitable = ville réelle ET (rue OU code postal). */
export function hasUsableAddress(p: ProviderAddressInput): boolean {
  const ville = (p.ville ?? "").trim();
  if (!ville || ville === "À compléter") return false;
  const adresse = (p.adresse ?? "").trim();
  const cp = (p.code_postal ?? "").trim();
  return Boolean(adresse || cp);
}

/**
 * Choisit `LocalBusiness` uniquement si :
 *   - le slug mère est dans la whitelist
 *   - ET la fiche a une adresse réellement exploitable
 * Sinon retombe sur `ProfessionalService` (jamais d'erreur Google sur address vide).
 */
export function pickProviderType(
  slugMere: string | null | undefined,
  presta: ProviderAddressInput,
): "LocalBusiness" | "ProfessionalService" {
  if (!slugMere) return "ProfessionalService";
  if (!LOCAL_BUSINESS_SLUGS.has(slugMere)) return "ProfessionalService";
  return hasUsableAddress(presta) ? "LocalBusiness" : "ProfessionalService";
}

/* ───────────────────────── Price range formatting ──────────────────────── */

/** Format `priceRange` schema.org. Retourne null si aucun prix renseigné. */
export function formatPriceRange(
  prixDepart: number | null | undefined,
  prixMax: number | null | undefined,
): string | null {
  const min = typeof prixDepart === "number" && prixDepart > 0 ? prixDepart : null;
  const max = typeof prixMax === "number" && prixMax > 0 ? prixMax : null;
  if (min == null && max == null) return null;
  if (min != null && max != null) return `€${min}–€${max}`;
  if (min != null) return `À partir de €${min}`;
  return `Jusqu'à €${max}`;
}

/* ───────────────────────── Sitewide builders ───────────────────────────── */

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/og-default.jpg`,
  };
}

export function buildWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "fr-FR",
  };
}

/* ───────────────────────── BreadcrumbList ──────────────────────────────── */

export interface BreadcrumbItem {
  name: string;
  /** Path (e.g. "/prestataires/lieux-de-reception") or absolute URL. */
  url: string;
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: resolveAbsoluteUrl(it.url),
    })),
  };
}

/* ───────────────────────── Provider profile ────────────────────────────── */

export interface ProviderJsonLdInput {
  slug: string;
  slugMere: string;
  nom_commercial: string;
  description_courte?: string | null;
  description?: string | null;
  photo_principale_url?: string | null;
  ville?: string | null;
  region?: string | null;
  adresse?: string | null;
  code_postal?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  telephone?: string | null;
  site_web?: string | null;
  prix_depart?: number | null;
  prix_max?: number | null;
  note_moyenne?: number | null;
  nombre_avis?: number | null;
  updated_at?: string | null;
  zones_intervention?: string[] | null;
}

export interface ProviderReviewInput {
  note_globale: number;
  commentaire: string;
  titre?: string | null;
  created_at: string;
  author?: string | null;
}

export function buildProviderJsonLd(
  presta: ProviderJsonLdInput,
  reviews: ProviderReviewInput[] = [],
) {
  const type = pickProviderType(presta.slugMere, presta);
  const url = resolveAbsoluteUrl(`/prestataire/${presta.slug}`);

  const out: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": type,
    name: presta.nom_commercial,
    url,
  };

  if (presta.photo_principale_url) {
    out.image = resolveAbsoluteUrl(presta.photo_principale_url);
  }
  const desc = presta.description_courte || presta.description;
  if (desc) out.description = desc;
  if (presta.telephone) out.telephone = presta.telephone;
  if (presta.site_web) {
    out.sameAs = [
      presta.site_web.startsWith("http") ? presta.site_web : `https://${presta.site_web}`,
    ];
  }
  if (presta.region) out.areaServed = presta.region;
  if (presta.updated_at) out.dateModified = presta.updated_at;

  const price = formatPriceRange(presta.prix_depart, presta.prix_max);
  if (price) out.priceRange = price;

  // Address uniquement si LocalBusiness retenu (donc adresse exploitable).
  if (type === "LocalBusiness") {
    const address: Record<string, string> = {
      "@type": "PostalAddress",
      addressCountry: "FR",
    };
    if (presta.adresse?.trim()) address.streetAddress = presta.adresse.trim();
    if (presta.code_postal?.trim()) address.postalCode = presta.code_postal.trim();
    if (presta.ville?.trim()) address.addressLocality = presta.ville.trim();
    if (presta.region?.trim()) address.addressRegion = presta.region.trim();
    out.address = address;

    if (typeof presta.latitude === "number" && typeof presta.longitude === "number") {
      out.geo = {
        "@type": "GeoCoordinates",
        latitude: presta.latitude,
        longitude: presta.longitude,
      };
    }
  }

  if (
    typeof presta.note_moyenne === "number" &&
    typeof presta.nombre_avis === "number" &&
    presta.nombre_avis > 0
  ) {
    out.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(presta.note_moyenne.toFixed(1)),
      reviewCount: presta.nombre_avis,
      bestRating: 5,
      worstRating: 1,
    };
  }

  const latestReviews = reviews.slice(0, 3);
  if (latestReviews.length > 0) {
    out.review = latestReviews.map((r) => ({
      "@type": "Review",
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.note_globale,
        bestRating: 5,
        worstRating: 1,
      },
      author: { "@type": "Person", name: r.author || "Client vérifié" },
      datePublished: r.created_at,
      ...(r.titre ? { name: r.titre } : {}),
      reviewBody: r.commentaire,
    }));
  }

  return out;
}

/* ───────────────────────── Category list (CollectionPage) ──────────────── */

export interface CategoryListItem {
  name: string;
  slug: string;
  position: number;
}

export function buildCategoryListJsonLd(opts: {
  name: string;
  description: string;
  canonicalPath: string;
  items: CategoryListItem[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    description: opts.description,
    url: resolveAbsoluteUrl(opts.canonicalPath),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: opts.items.length,
      itemListElement: opts.items.map((it) => ({
        "@type": "ListItem",
        position: it.position,
        url: resolveAbsoluteUrl(`/prestataire/${it.slug}`),
        name: it.name,
      })),
    },
  };
}

/* ───────────────────────── Region page (split) ─────────────────────────── */

export function buildRegionWebPageJsonLd(opts: {
  nomRegion: string;
  slugRegion: string;
  description: string;
  noteMoyenne?: number;
  nbAvis?: number;
}) {
  const out: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `Mariage en ${opts.nomRegion}`,
    url: resolveAbsoluteUrl(`/mariage/${opts.slugRegion}`),
    description: opts.description,
    about: {
      "@type": "Place",
      name: opts.nomRegion,
      areaServed: opts.nomRegion,
    },
  };
  if (
    typeof opts.noteMoyenne === "number" &&
    typeof opts.nbAvis === "number" &&
    opts.nbAvis > 0 &&
    opts.noteMoyenne > 0
  ) {
    out.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(opts.noteMoyenne.toFixed(1)),
      reviewCount: opts.nbAvis,
      bestRating: 5,
      worstRating: 1,
    };
  }
  return out;
}

export function buildFaqPageJsonLd(faq: { question: string; reponse: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.reponse.replace(/\*\*/g, ""),
      },
    })),
  };
}

/* ───────────────────────── Blog (Article + list) ───────────────────────── */

export interface ArticleJsonLdInput {
  titre: string;
  slug: string;
  extrait?: string | null;
  image_couverture_url?: string | null;
  publie_le?: string | null;
  updated_at?: string | null;
  authorName: string;
}

export function buildArticleJsonLd(a: ArticleJsonLdInput) {
  const url = resolveAbsoluteUrl(`/blog/${a.slug}`);
  const out: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.titre,
    mainEntityOfPage: url,
    url,
    author: { "@type": "Person", name: a.authorName },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/og-default.jpg`,
      },
    },
  };
  if (a.extrait) out.description = a.extrait;
  if (a.image_couverture_url) out.image = resolveAbsoluteUrl(a.image_couverture_url);
  if (a.publie_le) out.datePublished = a.publie_le;
  if (a.updated_at) out.dateModified = a.updated_at;
  return out;
}

export function buildBlogIndexJsonLd(items: { titre: string; slug: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    url: resolveAbsoluteUrl("/blog"),
    name: `${SITE_NAME} — Le Journal`,
    blogPost: items.slice(0, 10).map((a, i) => ({
      "@type": "BlogPosting",
      position: i + 1,
      headline: a.titre,
      url: resolveAbsoluteUrl(`/blog/${a.slug}`),
    })),
  };
}

/* ───────────────────────── Homepage category ItemList ──────────────────── */

export function buildHomeCategoriesJsonLd(
  items: { nom: string; slug: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Catégories de prestataires mariage",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: resolveAbsoluteUrl(`/prestataires/${c.slug}`),
      name: c.nom,
    })),
  };
}
