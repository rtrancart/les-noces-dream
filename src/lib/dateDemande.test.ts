import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { formaterDateEvenement } from "./dateDemande";

describe("formaterDateEvenement", () => {
  it("date précise", () => expect(formaterDateEvenement("2026-06-15", "jour")).toBe("15 juin 2026"));
  it("1er du mois en date précise", () => expect(formaterDateEvenement("2026-06-01", "jour")).toBe("1er juin 2026"));
  it("mois seulement", () => expect(formaterDateEvenement("2026-06-01", "mois")).toBe("Juin 2026 (jour non fixé)"));
  it("sans date", () => expect(formaterDateEvenement(null, null)).toBe("Non précisée"));
  it("version emails strictement identique", () => {
    const corps = (p: string) => readFileSync(p, "utf8").split("\n").slice(1).join("\n");
    expect(corps("supabase/functions/_shared/date-demande.ts")).toBe(corps("src/lib/dateDemande.ts"));
  });
});
