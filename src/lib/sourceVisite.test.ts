import { describe, it, expect } from "vitest";
import { extraireSource } from "./sourceVisite";

describe("extraireSource", () => {
  it("garde seulement le domaine du referrer, sans www", () => {
    const s = extraireSource("https://lesnoces.net/", "https://www.google.fr/search?q=x", "lesnoces.net");
    expect(s.referrer_domaine).toBe("google.fr");
  });
  it("ne stocke jamais la valeur du gclid, seulement sa présence", () => {
    const s = extraireSource("https://lesnoces.net/?gclid=ABC123", "", "lesnoces.net");
    expect(s.gclid_present).toBe(true);
    expect(JSON.stringify(s)).not.toContain("ABC123");
  });
  it("ignore un referrer interne", () => {
    const s = extraireSource("https://lesnoces.net/a", "https://www.lesnoces.net/b", "lesnoces.net");
    expect(s.referrer_domaine).toBeNull();
  });
  it("lit les utm en minuscules", () => {
    const s = extraireSource("https://lesnoces.net/?utm_source=ChatGPT.com&utm_medium=CPC", "", "lesnoces.net");
    expect(s.utm_source).toBe("chatgpt.com");
    expect(s.utm_medium).toBe("cpc");
  });
});
