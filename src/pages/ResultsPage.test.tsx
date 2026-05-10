import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
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
vi.mock("@/contexts/ZonesContext", () => ({
  useZones: () => ({
    bySlug: new Map(),
    byZoneValue: new Map(),
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

// Supabase mock: chainable thenable builder. Resolves to category-mère for the
// initial `.maybeSingle()` call, null for the fille lookup, and the fixtures
// list for the providers query.
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
          // Mère lookup: parent_id IS NULL + slug=photographe
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
          // Fille lookup: parent_id=cat1 + slug=paris → not a category
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
      then(resolve: any) {
        // Awaited directly: providers query
        if (table === "prestataires") {
          resolve({ data: PRESTA_FIXTURES, error: null });
        } else {
          resolve({ data: null, error: null });
        }
      },
    };
    return builder;
  }
  return {
    supabase: {
      from: (t: string) => makeBuilder(t),
    },
  };
});

/* ───────── Helpers ───────── */

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
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders the skeleton immediately on mount while geo.api.gouv.fr is pending", async () => {
    // geo.api.gouv.fr never resolves
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

    // Flush only microtasks (awaited supabase mocks resolving) — DO NOT advance
    // timers, so the geo call is still pending and the page must already be
    // showing a skeleton without blocking.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Skeleton placeholders use the .animate-pulse utility from Tailwind.
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);

    // No provider cards rendered yet
    expect(screen.queryAllByTestId("provider-card")).toHaveLength(0);
  });

  it("replaces the skeleton with 3 provider cards once geo.api.gouv.fr resolves", async () => {
    // geo.api.gouv.fr resolves successfully after 1s
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: any, _init: any) =>
          new Promise<Response>((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                status: 200,
                json: async () => [
                  {
                    nom: "Paris",
                    code: "75056",
                    codeRegion: "11",
                    codeDepartement: "75",
                    centre: { coordinates: [2.3522, 48.8566] },
                  },
                ],
              } as Response);
            }, 1000);
          })
      )
    );

    renderAt("/prestataires/photographe/paris");

    // Initial render: skeleton present
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);

    // Advance the 1s timer → fetch resolves → providers query fires → render.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      // flush extra microtasks for the chained state updates
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const cards = screen.getAllByTestId("provider-card");
    expect(cards).toHaveLength(3);
    expect(document.querySelectorAll(".animate-pulse").length).toBe(0);
  });
});
