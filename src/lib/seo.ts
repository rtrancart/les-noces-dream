/**
 * Centralized SEO tag manager.
 *
 * Single source of truth for every page's <head> metadata. All page-level
 * SEO must go through `buildSeoMeta()` so that fallback scenarios (e.g.
 * geo.api.gouv.fr failure) cannot produce inconsistent metadata between,
 * say, <title> and og:title.
 *
 * For React pages, render the returned object via the <SeoHead> component
 * (uses react-helmet-async, which is what Vercel's prerenderer snapshots
 * into the static HTML).
 *
 * `applySeo()` is kept as a low-level DOM fallback used by legacy code paths
 * and by tests that assert directly on document.head.
 */

/**
 * Default social-share image used for og:image and twitter:image when a page
 * does not provide its own. Path is resolved against `window.location.origin`
 * so crawlers always receive an absolute URL.
 */
export const DEFAULT_SEO_IMAGE_PATH = "/og-default.jpg";

const SITE_NAME_DEFAULT = "LesNoces.net";
const SITE_ORIGIN_DEFAULT = "https://lesnoces.net";

function resolveOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : SITE_ORIGIN_DEFAULT;
}

export function resolveAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${resolveOrigin()}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}


/** Input shape accepted by `buildSeoMeta()` — what each page provides. */
export interface SeoInput {
  /** Page title — used for <title>, og:title and twitter:title. */
  title: string;
  /** Description — used for meta description, og:description, twitter:description. */
  description: string;
  /**
   * Canonical URL or path. Used for <link rel=canonical> and og:url.
   * Accepts absolute URL or path starting with "/".
   */
  canonicalUrl: string;
  /** og:image + twitter:image. Defaults to `DEFAULT_SEO_IMAGE_PATH`. */
  imageUrl?: string;
  /** og:type — defaults to "website". */
  ogType?: string;
  /** twitter:card — defaults to "summary_large_image". */
  twitterCard?: string;
  /** og:site_name — defaults to "LesNoces.net". */
  siteName?: string;
  /** When true, emits `<meta name="robots" content="noindex, nofollow">`. */
  noindex?: boolean;
}

/**
 * Fully-resolved SEO tag set. Every value is a non-empty string ready to
 * be injected into <head>. There is no optionality at this layer — that is
 * the whole point of the helper.
 */
export interface SeoMeta {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogUrl: string;
  ogType: string;
  ogSiteName: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  /** "index, follow" by default; "noindex, nofollow" when input.noindex is true. */
  robots: string;
}

/**
 * Pure helper — takes a page's SEO input and returns the fully-expanded
 * 13-tag set. All og: and twitter: tags are derived from the same source
 * values so they can never drift.
 */
export function buildSeoMeta(input: SeoInput): SeoMeta {
  const title = input.title;
  const description = input.description;
  const canonical = resolveAbsoluteUrl(input.canonicalUrl);
  const image = resolveAbsoluteUrl(input.imageUrl ?? DEFAULT_SEO_IMAGE_PATH);
  const ogType = input.ogType ?? "website";
  const twitterCard = input.twitterCard ?? "summary_large_image";
  const siteName = input.siteName ?? SITE_NAME_DEFAULT;

  return {
    title,
    description,
    canonical,
    ogTitle: title,
    ogDescription: description,
    ogImage: image,
    ogUrl: canonical,
    ogType,
    ogSiteName: siteName,
    twitterCard,
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: image,
    robots: input.noindex ? "noindex, nofollow" : "index, follow",
  };
}

/* ───────── Legacy DOM applier (kept for tests + non-React callers) ───────── */

/** @deprecated Prefer <SeoHead> with `buildSeoMeta()`. */
export interface SeoTags extends SeoInput {}

function setMetaName(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setMetaProperty(property: string, content: string) {
  let el = document.querySelector(
    `meta[property="${property}"]`
  ) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonicalLink(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Directly mutate <head> with a coherent SEO tag set. Prefer <SeoHead> in
 * React render trees; this exists for environments where rendering Helmet
 * is not an option.
 */
export function applySeo(input: SeoInput): void {
  if (typeof document === "undefined") return;
  const m = buildSeoMeta(input);

  document.title = m.title;
  setMetaName("description", m.description);
  setMetaName("robots", m.robots);
  setCanonicalLink(m.canonical);

  setMetaProperty("og:title", m.ogTitle);
  setMetaProperty("og:description", m.ogDescription);
  setMetaProperty("og:url", m.ogUrl);
  setMetaProperty("og:type", m.ogType);
  setMetaProperty("og:site_name", m.ogSiteName);
  setMetaProperty("og:image", m.ogImage);

  setMetaName("twitter:card", m.twitterCard);
  setMetaName("twitter:title", m.twitterTitle);
  setMetaName("twitter:description", m.twitterDescription);
  setMetaName("twitter:image", m.twitterImage);
}
