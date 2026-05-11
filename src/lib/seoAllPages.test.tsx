import { describe, it, expect, afterEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";

import SeoHead from "@/components/SeoHead";
import type { SeoInput } from "@/lib/seo";

/* ───────── Helpers ──────────────────────────────────────────── */

/**
 * Renders <SeoHead> with the exact input a given page would produce, then
 * returns the resolved tag map (so the test can assert per-tag rules).
 */
async function renderSeoForPage(input: SeoInput) {
  const result = render(
    <HelmetProvider>
      <SeoHead {...input} />
    </HelmetProvider>
  );

  // Helmet applies tags asynchronously after mount — wait for the title.
  await waitFor(() => {
    expect(document.title).toBeTruthy();
  });

  return result;
}

const FULL_TAGS = [
  { name: "title", get: () => document.title },
  { name: "description", get: () => document.querySelector('meta[name="description"]')?.getAttribute("content") },
  { name: "robots", get: () => document.querySelector('meta[name="robots"]')?.getAttribute("content") },
  { name: "canonical", get: () => document.querySelector('link[rel="canonical"]')?.getAttribute("href") },
  { name: "og:title", get: () => document.querySelector('meta[property="og:title"]')?.getAttribute("content") },
  { name: "og:description", get: () => document.querySelector('meta[property="og:description"]')?.getAttribute("content") },
  { name: "og:image", get: () => document.querySelector('meta[property="og:image"]')?.getAttribute("content") },
  { name: "og:url", get: () => document.querySelector('meta[property="og:url"]')?.getAttribute("content") },
  { name: "og:type", get: () => document.querySelector('meta[property="og:type"]')?.getAttribute("content") },
  { name: "og:site_name", get: () => document.querySelector('meta[property="og:site_name"]')?.getAttribute("content") },
  { name: "twitter:card", get: () => document.querySelector('meta[name="twitter:card"]')?.getAttribute("content") },
  { name: "twitter:title", get: () => document.querySelector('meta[name="twitter:title"]')?.getAttribute("content") },
  { name: "twitter:description", get: () => document.querySelector('meta[name="twitter:description"]')?.getAttribute("content") },
  { name: "twitter:image", get: () => document.querySelector('meta[name="twitter:image"]')?.getAttribute("content") },
];

function assertAllTagsValid(pageLabel: string) {
  for (const { name, get } of FULL_TAGS) {
    const value = get();
    expect(value, `[${pageLabel}] tag "${name}" is missing from <head>`).toBeTruthy();
    expect(
      value!.length,
      `[${pageLabel}] tag "${name}" must not be an empty string`
    ).toBeGreaterThan(0);
    expect(
      value!.toLowerCase().includes("undefined"),
      `[${pageLabel}] tag "${name}" contains the string "undefined" (value: "${value}")`
    ).toBe(false);
  }
}

/* ───────── Indexed pages — must expose the full 13-tag block ──────────────── */

interface PageCase {
  label: string;
  input: SeoInput;
}

const INDEXED_PAGES: PageCase[] = [
  {
    label: "/",
    input: {
      title: "LesNoces.net — Prestataires de mariage haut de gamme sélectionnés",
      description:
        "Trouvez les meilleurs prestataires de mariage haut de gamme en France. Lieux de réception, photographes, traiteurs, fleuristes et plus encore — sélectionnés par LesNoces.net.",
      canonicalUrl: "/",
    },
  },
  {
    label: "/prestataires/photographe",
    input: {
      title: "Photographes de mariage — Prestataires haut de gamme | LesNoces.net",
      description: "Notre sélection de photographes de mariage haut de gamme partout en France.",
      canonicalUrl: "/prestataires/photographe",
    },
  },
  {
    label: "/prestataires/photographe/paris",
    input: {
      title: "Photographes de mariage à Paris | LesNoces.net",
      description: "12 photographes de mariage sélectionnés à Paris.",
      canonicalUrl: "/prestataires/photographe/paris",
    },
  },
  {
    label: "/prestataires/photographe/videaste",
    input: {
      title: "Vidéastes de mariage — Photographes & Vidéastes | LesNoces.net",
      description: "Vidéastes de mariage haut de gamme sélectionnés par LesNoces.net.",
      canonicalUrl: "/prestataires/photographe/videaste",
    },
  },
  {
    label: "/prestataire/studio-lumiere (fixture)",
    input: {
      // Mirrors FichePrestataire.tsx
      title: "Studio Lumière — Photographe à Paris | LesNoces.net",
      description:
        "Découvrez Studio Lumière, photographe à Paris. Avis, photos, tarifs et demande de devis sur LesNoces.net.",
      canonicalUrl: "/prestataire/studio-lumiere",
      imageUrl: "https://cdn.lesnoces.net/photos/studio-lumiere/cover.jpg",
    },
  },
  {
    label: "/blog",
    input: {
      title: "Blog mariage — Inspirations et conseils | LesNoces.net",
      description:
        "Le carnet d'une rédaction qui parcourt la France des belles noces — chroniques, carnets de lieux, confidences d'artisans.",
      canonicalUrl: "/blog",
    },
  },
  {
    label: "/blog/comment-choisir-son-photographe (fixture)",
    input: {
      // Mirrors BlogArticle.tsx: ogType="article" + dynamic image
      title: "Comment choisir son photographe de mariage | LesNoces.net",
      description:
        "Nos conseils pour choisir le photographe qui saura raconter votre mariage avec justesse.",
      canonicalUrl: "/blog/comment-choisir-son-photographe",
      imageUrl: "https://cdn.lesnoces.net/blog/photographe-mariage/cover.jpg",
      ogType: "article",
    },
  },
];

describe("SeoHead — every indexed page exposes a complete, non-undefined 13-tag block", () => {
  afterEach(() => {
    cleanup();
    // Helmet leaks tags into document.head across tests — flush manually.
    document.head.querySelectorAll(
      'meta, link[rel="canonical"]'
    ).forEach((el) => el.remove());
    document.title = "";
  });

  for (const { label, input } of INDEXED_PAGES) {
    it(`page ${label}`, async () => {
      await renderSeoForPage(input);
      assertAllTagsValid(label);

      // robots must explicitly authorise indexing on these pages.
      expect(
        document.querySelector('meta[name="robots"]')?.getAttribute("content"),
        `[${label}] robots meta must be "index, follow"`
      ).toBe("index, follow");

      // canonical must be absolute.
      expect(
        document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
        `[${label}] canonical must be an absolute URL`
      ).toMatch(/^https?:\/\//);

      // og:image must be absolute (default or page-provided).
      expect(
        document.querySelector('meta[property="og:image"]')?.getAttribute("content"),
        `[${label}] og:image must be an absolute URL`
      ).toMatch(/^https?:\/\//);
    });
  }
});

/* ───────── Noindex pages — must NOT expose og:/twitter: tags ──────────────── */

const NOINDEX_PAGES: PageCase[] = [
  {
    label: "/mon-compte (client)",
    input: {
      title: "Mon espace | LesNoces.net",
      description: "Mon espace LesNoces.net — accès réservé.",
      canonicalUrl: "/mon-compte",
      noindex: true,
    },
  },
  {
    label: "/espace-pro (prestataire)",
    input: {
      title: "Espace prestataire | LesNoces.net",
      description: "Espace prestataire LesNoces.net — accès réservé.",
      canonicalUrl: "/espace-pro",
      noindex: true,
    },
  },
  {
    label: "/connexion",
    input: {
      title: "Connexion | LesNoces.net",
      description: "Connectez-vous à votre espace LesNoces.net.",
      canonicalUrl: "/connexion",
      noindex: true,
    },
  },
];

describe("SeoHead — noindex pages expose robots noindex and no social tags", () => {
  afterEach(() => {
    cleanup();
    document.head.querySelectorAll(
      'meta, link[rel="canonical"]'
    ).forEach((el) => el.remove());
    document.title = "";
  });

  for (const { label, input } of NOINDEX_PAGES) {
    it(`page ${label}`, async () => {
      await renderSeoForPage(input);

      // 1. robots is present and asks crawlers to stay away.
      const robots = document.querySelector('meta[name="robots"]')?.getAttribute("content");
      expect(robots, `[${label}] robots meta must be present`).toBeTruthy();
      expect(robots, `[${label}] robots must be "noindex, nofollow"`).toBe(
        "noindex, nofollow"
      );

      // 2. No og:* tag must leak into <head>.
      const ogTags = document.querySelectorAll('meta[property^="og:"]');
      expect(
        ogTags.length,
        `[${label}] no og:* tag should be rendered (found ${ogTags.length})`
      ).toBe(0);

      // 3. No twitter:* tag must leak into <head>.
      const twitterTags = document.querySelectorAll('meta[name^="twitter:"]');
      expect(
        twitterTags.length,
        `[${label}] no twitter:* tag should be rendered (found ${twitterTags.length})`
      ).toBe(0);
    });
  }
});
