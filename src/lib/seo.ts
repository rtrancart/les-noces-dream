/**
 * Centralized SEO tag manager.
 *
 * All page-level SEO updates (title, description, canonical, Open Graph,
 * Twitter Card) must go through `applySeo()` so that fallback scenarios
 * (e.g. geo.api.gouv.fr failure) cannot produce inconsistent metadata
 * between, say, <title> and og:title.
 */

/**
 * Default social-share image used for og:image and twitter:image when a page
 * does not provide its own. Path is resolved against `window.location.origin`
 * so crawlers always receive an absolute URL.
 */
export const DEFAULT_SEO_IMAGE_PATH = "/og-default.jpg";

function resolveAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://lesnoces.net";
  return `${origin}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

export interface SeoTags {
  /** <title> + og:title + twitter:title */
  title: string;
  /** meta[name=description] + og:description + twitter:description */
  description: string;
  /** link[rel=canonical] + og:url */
  canonicalUrl: string;
  /** og:type — defaults to "website" */
  ogType?: string;
  /** twitter:card — defaults to "summary_large_image" */
  twitterCard?: string;
  /**
   * og:image + twitter:image. If omitted, falls back to
   * `DEFAULT_SEO_IMAGE_PATH` so the tags are always populated.
   * Accepts either an absolute URL or a path starting with "/".
   */
  imageUrl?: string;
  /** og:site_name (optional) */
  siteName?: string;
}

function setMetaName(name: string, content: string) {
  let el = document.querySelector(
    `meta[name="${name}"]`
  ) as HTMLMetaElement | null;
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
  let el = document.querySelector(
    'link[rel="canonical"]'
  ) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Apply a coherent set of SEO tags to <head>.
 *
 * The same `title`, `description`, and `canonicalUrl` values are propagated
 * to every related tag so we cannot end up with, for example, a fallback
 * slug in <title> but a stale resolved-city name in og:title.
 */
export function applySeo(tags: SeoTags): void {
  if (typeof document === "undefined") return;

  const ogType = tags.ogType ?? "website";
  const twitterCard = tags.twitterCard ?? "summary_large_image";

  document.title = tags.title;

  setMetaName("description", tags.description);
  setCanonicalLink(tags.canonicalUrl);

  setMetaProperty("og:title", tags.title);
  setMetaProperty("og:description", tags.description);
  setMetaProperty("og:url", tags.canonicalUrl);
  setMetaProperty("og:type", ogType);

  if (tags.siteName) setMetaProperty("og:site_name", tags.siteName);

  const imageUrl = resolveAbsoluteUrl(tags.imageUrl ?? DEFAULT_SEO_IMAGE_PATH);
  setMetaProperty("og:image", imageUrl);
  setMetaName("twitter:image", imageUrl);

  setMetaName("twitter:card", twitterCard);
  setMetaName("twitter:title", tags.title);
  setMetaName("twitter:description", tags.description);
}
