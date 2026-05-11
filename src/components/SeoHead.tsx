import { Helmet } from "react-helmet-async";
import { buildSeoMeta, type SeoInput } from "@/lib/seo";

/**
 * Renders the canonical SEO tag set into <head> via react-helmet-async.
 *
 * Vercel's prerenderer snapshots the DOM after Helmet has applied its tags,
 * so the resulting static HTML contains the full meta block — readable by
 * non-JS crawlers (Facebook, Twitter/X, LinkedIn, Slack, WhatsApp…).
 *
 * Every tag's value flows through `buildSeoMeta()` — no hardcoded fallbacks
 * are allowed at the call site.
 *
 * When `noindex` is true, we deliberately emit ONLY the robots meta tag
 * (plus title/description/canonical for the browser tab). Skipping og:/twitter:
 * tags on noindex pages prevents them from being shared/indexed via social
 * crawlers — the whole point of marking them noindex.
 */
export default function SeoHead(input: SeoInput) {
  const m = buildSeoMeta(input);

  if (input.noindex) {
    return (
      <Helmet>
        <title>{m.title}</title>
        <meta name="description" content={m.description} />
        <meta name="robots" content={m.robots} />
        <link rel="canonical" href={m.canonical} />
      </Helmet>
    );
  }

  return (
    <Helmet>
      <title>{m.title}</title>
      <meta name="description" content={m.description} />
      <meta name="robots" content={m.robots} />
      <link rel="canonical" href={m.canonical} />

      <meta property="og:title" content={m.ogTitle} />
      <meta property="og:description" content={m.ogDescription} />
      <meta property="og:image" content={m.ogImage} />
      <meta property="og:url" content={m.ogUrl} />
      <meta property="og:type" content={m.ogType} />
      <meta property="og:site_name" content={m.ogSiteName} />

      <meta name="twitter:card" content={m.twitterCard} />
      <meta name="twitter:title" content={m.twitterTitle} />
      <meta name="twitter:description" content={m.twitterDescription} />
      <meta name="twitter:image" content={m.twitterImage} />
    </Helmet>
  );
}
