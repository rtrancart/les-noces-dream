import { describe, it, expect } from "vitest";
import {
  pickProviderType,
  hasUsableAddress,
  formatPriceRange,
  buildProviderJsonLd,
  buildBreadcrumbJsonLd,
  LOCAL_BUSINESS_SLUGS,
} from "./jsonld";

describe("LOCAL_BUSINESS_SLUGS", () => {
  it("contient les 3 catégories à présence physique", () => {
    expect(LOCAL_BUSINESS_SLUGS.has("lieux-de-reception")).toBe(true);
    expect(LOCAL_BUSINESS_SLUGS.has("hebergements")).toBe(true);
    expect(LOCAL_BUSINESS_SLUGS.has("caviste-domaine-viticole")).toBe(true);
    expect(LOCAL_BUSINESS_SLUGS.has("photographe-videaste")).toBe(false);
  });
});

describe("hasUsableAddress", () => {
  it("rejette ville vide ou 'À compléter'", () => {
    expect(hasUsableAddress({ ville: "", code_postal: "75001" })).toBe(false);
    expect(hasUsableAddress({ ville: "À compléter", code_postal: "75001" })).toBe(false);
  });
  it("exige ville ET (adresse OU code_postal)", () => {
    expect(hasUsableAddress({ ville: "Paris" })).toBe(false);
    expect(hasUsableAddress({ ville: "Paris", code_postal: "75001" })).toBe(true);
    expect(hasUsableAddress({ ville: "Paris", adresse: "1 rue X" })).toBe(true);
  });
});

describe("pickProviderType", () => {
  it("slug local + adresse OK → LocalBusiness", () => {
    expect(
      pickProviderType("lieux-de-reception", { ville: "Lyon", code_postal: "69001" }),
    ).toBe("LocalBusiness");
  });
  it("slug local + adresse vide → ProfessionalService", () => {
    expect(pickProviderType("lieux-de-reception", { ville: "À compléter" })).toBe(
      "ProfessionalService",
    );
  });
  it("slug non local → ProfessionalService", () => {
    expect(
      pickProviderType("photographe-videaste", { ville: "Paris", code_postal: "75001" }),
    ).toBe("ProfessionalService");
  });
  it("slug null → ProfessionalService", () => {
    expect(pickProviderType(null, { ville: "Paris", code_postal: "75001" })).toBe(
      "ProfessionalService",
    );
  });
});

describe("formatPriceRange", () => {
  it("retourne null si tout est null", () => {
    expect(formatPriceRange(null, null)).toBeNull();
  });
  it("min seul", () => {
    expect(formatPriceRange(2000, null)).toBe("À partir de €2000");
  });
  it("min + max", () => {
    expect(formatPriceRange(2000, 5000)).toBe("€2000–€5000");
  });
  it("max seul", () => {
    expect(formatPriceRange(null, 5000)).toBe("Jusqu'à €5000");
  });
});

describe("buildProviderJsonLd", () => {
  const base = {
    slug: "domaine-x",
    slugMere: "lieux-de-reception",
    nom_commercial: "Domaine X",
    ville: "Aix",
    adresse: "1 chemin Y",
    code_postal: "13100",
    region: "Provence-Alpes-Côte d'Azur",
    updated_at: "2026-01-01T00:00:00Z",
  };
  it("émet LocalBusiness + address + dateModified", () => {
    const ld = buildProviderJsonLd(base);
    expect(ld["@type"]).toBe("LocalBusiness");
    expect(ld.address).toBeDefined();
    expect(ld.dateModified).toBe("2026-01-01T00:00:00Z");
  });
  it("n'émet pas aggregateRating si 0 avis", () => {
    const ld = buildProviderJsonLd({ ...base, note_moyenne: 0, nombre_avis: 0 });
    expect(ld.aggregateRating).toBeUndefined();
  });
  it("émet aggregateRating si avis > 0", () => {
    const ld = buildProviderJsonLd({ ...base, note_moyenne: 4.7, nombre_avis: 12 });
    expect(ld.aggregateRating).toMatchObject({ ratingValue: 4.7, reviewCount: 12 });
  });
  it("n'émet pas priceRange si pas de prix", () => {
    const ld = buildProviderJsonLd(base);
    expect(ld.priceRange).toBeUndefined();
  });
  it("plafonne reviews à 3", () => {
    const reviews = Array.from({ length: 10 }, (_, i) => ({
      note_globale: 5,
      commentaire: `c${i}`,
      created_at: "2026-01-01",
    }));
    const ld = buildProviderJsonLd(base, reviews);
    expect((ld.review as unknown[]).length).toBe(3);
  });
  it("ProfessionalService n'émet pas address", () => {
    const ld = buildProviderJsonLd({ ...base, slugMere: "photographe-videaste" });
    expect(ld["@type"]).toBe("ProfessionalService");
    expect(ld.address).toBeUndefined();
  });
});

describe("buildBreadcrumbJsonLd", () => {
  it("génère positions 1..N en URL absolue", () => {
    const ld = buildBreadcrumbJsonLd([
      { name: "Accueil", url: "/" },
      { name: "Cat", url: "/prestataires/x" },
    ]);
    const items = ld.itemListElement as Array<{ position: number; item: string }>;
    expect(items[0].position).toBe(1);
    expect(items[1].position).toBe(2);
    expect(items[0].item).toMatch(/^https?:\/\//);
  });
});
