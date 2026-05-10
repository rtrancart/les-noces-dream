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
      then(resolve: any) {
        if (table === "prestataires") {
          resolve({ data: PRESTA_FIXTURES, error: null });
        } else {
          resolve({ data: null, error: null });
        }
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

    renderAt("/prestataires/photographe/paris");

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
          nom: "Paris",
          code: "75056",
          codeRegion: "11",
          codeDepartement: "75",
          centre: { coordinates: [2.3522, 48.8566] },
        },
      ],
    } as Response);

    await waitFor(() => {
      expect(screen.getAllByTestId("provider-card")).toHaveLength(3);
    });
    expect(document.querySelectorAll(".animate-pulse").length).toBe(0);
  });
});
