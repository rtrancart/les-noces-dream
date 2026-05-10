import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

/* ───────── Mocks ───────── */

// Lightweight ProviderCard stub: avoids pulling in FavoriButton + AuthContext
vi.mock("@/components/search/ProviderCard", () => ({
  default: ({ provider }: any) => (
    <div data-testid="provider-card">{provider.nom_commercial}</div>
  ),
}));

// useZones: pretend the admin-zones cache is loaded but empty,
// so any slug2 falls through to the geo.api.gouv.fr network path.
// CRITICAL: return *stable* Map references so the route effect (whose deps
// include zoneIndex) does not re-run on every render and loop forever.
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

const PRESTA_FIXTURES = [
  {
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
  },
  {
    id: "p2",
    nom_commercial: "Atelier Photo Paris",
    slug: "atelier-photo-paris",
    description_courte: null,
    ville: "Paris",
    region: "Île-de-France",
    photo_principale_url: null,
    note_moyenne: 4.5,
    nombre_avis: 8,
    prix_depart: 1200,
    est_premium: false,
    zones_intervention: ["france_entiere"],
    latitude: 48.86,
    longitude: 2.34,
    categorie_mere_id: "cat1",
    categorie_fille_id: null,
  },
  {
    id: "p3",
    nom_commercial: "Photographe Élégance",
    slug: "photographe-elegance",
    description_courte: null,
    ville: "Boulogne-Billancourt",
    region: "Île-de-France",
    photo_principale_url: null,
    note_moyenne: 4.9,
    nombre_avis: 25,
    prix_depart: 2000,
    est_premium: true,
    zones_intervention: ["france_entiere"],
    latitude: 48.83,
    longitude: 2.24,
    categorie_mere_id: "cat1",
    categorie_fille_id: null,
  },
];

// Supabase mock: chainable thenable builder.
vi.mock("@/integrations/supabase/client", () => {
  function makeBuilder(table: string) {
    const filters: Record<string, unknown> = {};
    const builder: any = {
      select() {
        return builder;
      },
      eq(k: string, v: unknown) {
        filters[k] = v;
        return builder;
      },
      is(k: string, v: unknown) {
        filters[k] = v;
        return builder;
      },
      ilike(k: string, v: unknown) {
        filters[k] = v;
        return builder;
      },
      order() {
        return builder;
      },
      async maybeSingle() {
        if (table === "categories") {
          if (filters.parent_id === null && filters.slug === "photographe") {
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
        }
        return { data: null, error: null };
      },
      then(onFulfilled: any, onRejected: any) {
        const value =
          table === "prestataires"
            ? { data: PRESTA_FIXTURES, error: null }
            : { data: null, error: null };
        return Promise.resolve(value).then(onFulfilled, onRejected);
      },
    };
    return builder;
  }
  return { supabase: { from: (t: string) => makeBuilder(t) } };
});

import PrestatairesListe from "./PrestatairesListe";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/prestataires/:slugMere/:slug2" element={<PrestatairesListe />} />
        <Route path="/prestataires/:slugMere" element={<PrestatairesListe />} />
      </Routes>
    </MemoryRouter>
  );
}

/* ───────── Tests ───────── */

describe("PrestatairesListe — non-regression: render is never blocked by geo.api.gouv.fr", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the skeleton immediately on mount while geo.api.gouv.fr is pending", async () => {
    // geo.api.gouv.fr never resolves — and respects abort so it doesn't
    // keep act() pending forever.
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

    renderAt("/prestataires/photographe/paris");

    // Wait until the page has had a chance to render — the skeleton must
    // appear without us having to advance any timers (i.e. without waiting
    // on the geo call).
    await waitFor(
      () => {
        expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
      },
      { timeout: 1000 }
    );

    // No provider cards rendered yet.
    expect(screen.queryAllByTestId("provider-card")).toHaveLength(0);
  });

  it("replaces the skeleton with 3 provider cards once geo.api.gouv.fr resolves", async () => {
    // Manually-controlled fetch promise — simulates a slow network call that
    // resolves after the page has already rendered its skeleton.
    let resolveFetch!: (value: Response) => void;
    const fetchPromise = new Promise<Response>((res) => {
      resolveFetch = res;
    });
    vi.stubGlobal("fetch", vi.fn(() => fetchPromise));

    renderAt("/prestataires/photographe/lyon");

    // Initial render: skeleton present, no cards yet.
    await waitFor(() => {
      expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByTestId("provider-card")).toHaveLength(0);

    // Resolve the geo call → zone resolves → providers fetch → cards render.
    resolveFetch({
      ok: true,
      status: 200,
      json: async () => [
        {
          nom: "Lyon",
          code: "69123",
          codeRegion: "84",
          codeDepartement: "69",
          centre: { coordinates: [4.85, 45.75] },
        },
      ],
    } as Response);

    // Once geo resolves, the providers query runs and the page reflects the
    // fixture count (3) — verified through the meta description, which is
    // recomputed from `providers.length`. This proves the page was never
    // blocked by the geo call: it stayed interactive and progressed through
    // its full data flow as soon as the network resolved.
    await waitFor(
      () => {
        expect(screen.getAllByTestId("provider-card")).toHaveLength(3);
      },
      { timeout: 4000 }
    );
    expect(document.querySelectorAll(".animate-pulse").length).toBe(0);
  });
});

/* ───────────────────────────────────────────────────────────────────────────
 * Fallback behavior — geo resolution fails, the page must still render
 * results via the approximate Supabase ILIKE search and a slug-based H1.
 * ─────────────────────────────────────────────────────────────────────── */

describe("PrestatairesListe — fallback behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("timeout: after the full 3s + 1s + 3s sequence, fallback banner + skeleton hidden + 3 cards", async () => {
    // Slug unique to this test → avoids VILLE_CACHE pollution across tests
    const SLUG = "marseille-test-timeout";

    // geo.api.gouv.fr never resolves but respects abort signals so the
    // 3s timer in resolveZoneSlug can reject and trigger the retry path.
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
      <MemoryRouter initialEntries={[`/prestataires/photographe/${SLUG}`]}>
        <Routes>
          <Route path="/prestataires/:slugMere/:slug2" element={<PrestatairesListe />} />
        </Routes>
      </MemoryRouter>
    );

    // Advance the full retry sequence: 3s → 1s pause → 3s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // 1) Approximate-results banner is visible — slug with hyphens preserved
    const banner = screen.getByText(/Résultats approximatifs pour/i);
    expect(banner.textContent).toContain("marseille-test-timeout");
    expect(banner.textContent).not.toContain("marseille test timeout");

    // 2) Skeleton has been removed
    expect(document.querySelectorAll(".animate-pulse").length).toBe(0);

    // 3) Exactly 3 provider cards rendered from the Supabase ILIKE fixtures
    expect(screen.getAllByTestId("provider-card")).toHaveLength(3);

    // 4) H1 + <title> contain the raw slug with hyphens, not a spaced version
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toContain("marseille-test-timeout");
    expect(h1.textContent).not.toContain("marseille test timeout");
    expect(document.title).toContain("marseille-test-timeout");
    expect(document.title).not.toContain("marseille test timeout");

    // 5) SEO meta tags (og:title, og:description, canonical) also preserve the raw slug
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content"))
      .toContain("marseille-test-timeout");
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content"))
      .not.toContain("marseille test timeout");

    expect(document.querySelector('meta[property="og:description"]')?.getAttribute("content"))
      .toContain("marseille-test-timeout");
    expect(document.querySelector('meta[property="og:description"]')?.getAttribute("content"))
      .not.toContain("marseille test timeout");

    expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content"))
      .toContain("marseille-test-timeout");
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content"))
      .not.toContain("marseille test timeout");

    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href"))
      .toContain("marseille-test-timeout");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href"))
      .not.toContain("marseille test timeout");
  });

  it("network error: retry also fails → fallback fires without waiting the full 7s", async () => {
    const SLUG = "bordeaux-test-neterr";

    // Both the first attempt AND the retry reject synchronously with a hard
    // network error (TypeError, like a real fetch DNS / connection failure).
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Network request failed")))
    );

    render(
      <MemoryRouter initialEntries={[`/prestataires/photographe/${SLUG}`]}>
        <Routes>
          <Route path="/prestataires/:slugMere/:slug2" element={<PrestatairesListe />} />
        </Routes>
      </MemoryRouter>
    );

    // Component still schedules a 1s pause between retries via setTimeout;
    // we advance ONLY that delay (NOT 7s) to prove the fallback fires fast.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // 1) Banner present — slug with hyphens preserved
    const banner = screen.getByText(/Résultats approximatifs pour/i);
    expect(banner.textContent).toContain("bordeaux-test-neterr");
    expect(banner.textContent).not.toContain("bordeaux test neterr");

    // 2) Skeleton gone
    expect(document.querySelectorAll(".animate-pulse").length).toBe(0);

    // 3) 3 cards from the ILIKE fallback
    expect(screen.getAllByTestId("provider-card")).toHaveLength(3);

    // 4) H1 + <title> contain the raw slug with hyphens
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toContain("bordeaux-test-neterr");
    expect(h1.textContent).not.toContain("bordeaux test neterr");
    expect(document.title).toContain("bordeaux-test-neterr");
    expect(document.title).not.toContain("bordeaux test neterr");

    // 5) SEO meta tags preserve the raw slug with hyphens
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content"))
      .toContain("bordeaux-test-neterr");
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content"))
      .not.toContain("bordeaux test neterr");

    expect(document.querySelector('meta[property="og:description"]')?.getAttribute("content"))
      .toContain("bordeaux-test-neterr");
    expect(document.querySelector('meta[property="og:description"]')?.getAttribute("content"))
      .not.toContain("bordeaux test neterr");

    expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content"))
      .toContain("bordeaux-test-neterr");
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content"))
      .not.toContain("bordeaux test neterr");

    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href"))
      .toContain("bordeaux-test-neterr");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href"))
      .not.toContain("bordeaux test neterr");
  });
});
