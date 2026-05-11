import { describe, it, expect, afterEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

import { buildSeoMeta } from "@/lib/seo";

/* ───────── Unit: pure helper produces the full 13-tag set ───────── */

describe("buildSeoMeta", () => {
  it("derives og:* and twitter:* from a single (title, description, url, image) source", () => {
    const m = buildSeoMeta({
      title: "Photographe de mariage à Paris | LesNoces.net",
      description: "12 prestataires sélectionnés à Paris.",
      canonicalUrl: "https://lesnoces.net/prestataires/photographe/paris",
      imageUrl: "https://lesnoces.net/og-default.jpg",
    });

    expect(m.title).toBe("Photographe de mariage à Paris | LesNoces.net");
    expect(m.description).toBe("12 prestataires sélectionnés à Paris.");
    expect(m.canonical).toBe("https://lesnoces.net/prestataires/photographe/paris");
    expect(m.ogTitle).toBe(m.title);
    expect(m.ogDescription).toBe(m.description);
    expect(m.ogUrl).toBe(m.canonical);
    expect(m.ogImage).toBe("https://lesnoces.net/og-default.jpg");
    expect(m.ogType).toBe("website");
    expect(m.ogSiteName).toBe("LesNoces.net");
    expect(m.twitterCard).toBe("summary_large_image");
    expect(m.twitterTitle).toBe(m.title);
    expect(m.twitterDescription).toBe(m.description);
    expect(m.twitterImage).toBe(m.ogImage);
  });

  it("falls back to /og-default.jpg when no image is provided", () => {
    const m = buildSeoMeta({
      title: "t",
      description: "d",
      canonicalUrl: "/foo",
    });
    expect(m.ogImage).toMatch(/\/og-default\.jpg$/);
    expect(m.twitterImage).toBe(m.ogImage);
  });
});

/* ───────── Integration: every tag is present in <head> after mount ───────── */

vi.mock("@/components/search/ProviderCard", () => ({
  default: ({ provider }: any) => <div data-testid="provider-card">{provider.nom_commercial}</div>,
}));

const STABLE_BY_SLUG = new Map();
const STABLE_BY_ZONE_VALUE = new Map();
vi.mock("@/contexts/ZonesContext", () => ({
  useZones: () => ({
    bySlug: STABLE_BY_SLUG,
    byZoneValue: STABLE_BY_ZONE_VALUE,
    loaded: true,
  }),
  ZonesProvider: ({ children }: any) => children,
}));

vi.mock("@/integrations/supabase/client", () => {
  function makeBuilder(table: string) {
    const filters: Record<string, unknown> = {};
    const builder: any = {
      select() { return builder; },
      eq(k: string, v: unknown) { filters[k] = v; return builder; },
      is(k: string, v: unknown) { filters[k] = v; return builder; },
      ilike() { return builder; },
      order() { return builder; },
      async maybeSingle() {
        if (table === "categories" && filters.slug === "photographe") {
          return {
            data: {
              id: "cat1",
              nom: "Photographe",
              slug: "photographe",
              parent_id: null,
              description_seo: null,
              contenu_seo: null,
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
      then(onFulfilled: any, onRejected: any) {
        const value = table === "prestataires"
          ? { data: [{
              id: "p1",
              nom_commercial: "Studio Lumière",
              slug: "studio-lumiere",
              description_courte: null,
              ville: "Paris",
              region: "Île-de-France",
              photo_principale_url: null,
              note_moyenne: 4.8,
              nombre_avis: 12,
              prix_depart: 1500,
              est_premium: true,
              zones_intervention: ["france_entiere"],
              latitude: 48.85,
              longitude: 2.35,
              categorie_mere_id: "cat1",
              categorie_fille_id: null,
            }], error: null }
          : { data: null, error: null };
        return Promise.resolve(value).then(onFulfilled, onRejected);
      },
    };
    return builder;
  }
  return { supabase: { from: (t: string) => makeBuilder(t) } };
});

import PrestatairesListe from "@/pages/PrestatairesListe";

describe("SeoHead — every prerendered tag is present in <head> with a non-empty value", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the full 13-tag SEO block on a results page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: any, init: any) =>
          new Promise<Response>((_res, reject) => {
            init?.signal?.addEventListener?.("abort", () => {
              const err = new Error("Aborted");
              (err as any).name = "AbortError";
              reject(err);
            });
          })
      )
    );

    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/prestataires/photographe"]}>
          <Routes>
            <Route path="/prestataires/:slugMere" element={<PrestatairesListe />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    );

    await waitFor(
      () => {
        expect(document.title).toBeTruthy();
        expect(document.querySelector('meta[name="description"]')).toBeTruthy();
        expect(document.querySelector('link[rel="canonical"]')).toBeTruthy();
        expect(document.querySelector('meta[property="og:title"]')).toBeTruthy();
        expect(document.querySelector('meta[property="og:description"]')).toBeTruthy();
        expect(document.querySelector('meta[property="og:image"]')).toBeTruthy();
        expect(document.querySelector('meta[property="og:url"]')).toBeTruthy();
        expect(document.querySelector('meta[property="og:type"]')).toBeTruthy();
        expect(document.querySelector('meta[property="og:site_name"]')).toBeTruthy();
        expect(document.querySelector('meta[name="twitter:card"]')).toBeTruthy();
        expect(document.querySelector('meta[name="twitter:title"]')).toBeTruthy();
        expect(document.querySelector('meta[name="twitter:description"]')).toBeTruthy();
        expect(document.querySelector('meta[name="twitter:image"]')).toBeTruthy();
      },
      { timeout: 3000 }
    );

    const assertions: Array<[string, string | null]> = [
      ["title", document.title],
      ["description", document.querySelector('meta[name="description"]')?.getAttribute("content") ?? null],
      ["canonical", document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null],
      ["og:title", document.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? null],
      ["og:description", document.querySelector('meta[property="og:description"]')?.getAttribute("content") ?? null],
      ["og:image", document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? null],
      ["og:url", document.querySelector('meta[property="og:url"]')?.getAttribute("content") ?? null],
      ["og:type", document.querySelector('meta[property="og:type"]')?.getAttribute("content") ?? null],
      ["twitter:card", document.querySelector('meta[name="twitter:card"]')?.getAttribute("content") ?? null],
      ["twitter:title", document.querySelector('meta[name="twitter:title"]')?.getAttribute("content") ?? null],
      ["twitter:description", document.querySelector('meta[name="twitter:description"]')?.getAttribute("content") ?? null],
      ["twitter:image", document.querySelector('meta[name="twitter:image"]')?.getAttribute("content") ?? null],
    ];

    for (const [tag, value] of assertions) {
      expect(value, `${tag} must be a non-empty string`).toBeTruthy();
      expect(value!.length, `${tag} must not be empty`).toBeGreaterThan(0);
    }

    expect(document.querySelector('meta[property="og:type"]')?.getAttribute("content")).toBe("website");
    expect(document.querySelector('meta[name="twitter:card"]')?.getAttribute("content")).toBe("summary_large_image");

    expect(document.querySelector('meta[property="og:image"]')?.getAttribute("content"))
      .toMatch(/og-default\.jpg$/);
    expect(document.querySelector('meta[name="twitter:image"]')?.getAttribute("content"))
      .toMatch(/og-default\.jpg$/);
  });
});
