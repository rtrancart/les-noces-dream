import { describe, it, expect } from "vitest";
import { getImageUrl } from "./images";

const SUPABASE =
  "https://egbohbwiywgyyculswvf.supabase.co/storage/v1/object/public/prestataires-photos/abc/photo.jpg";

describe("getImageUrl", () => {
  it("returns empty string for null/undefined/empty", () => {
    expect(getImageUrl(null, "cover")).toBe("");
    expect(getImageUrl(undefined, "cover")).toBe("");
    expect(getImageUrl("", "thumb")).toBe("");
  });

  it("returns external URLs unchanged", () => {
    const ext = "https://example.com/foo.jpg";
    expect(getImageUrl(ext, "cover")).toBe(ext);
    expect(getImageUrl("/placeholder.svg", "thumb")).toBe("/placeholder.svg");
  });

  it("rewrites Supabase object URL to render endpoint with cover preset", () => {
    const out = getImageUrl(SUPABASE, "cover");
    expect(out).toContain("/storage/v1/render/image/public/");
    expect(out).not.toContain("/storage/v1/object/public/");
    expect(out).toContain("width=1200");
    expect(out).toContain("quality=80");
  });

  it("applies thumb preset", () => {
    const out = getImageUrl(SUPABASE, "thumb");
    expect(out).toContain("width=400");
    expect(out).toContain("quality=75");
  });

  it("applies hero preset", () => {
    const out = getImageUrl(SUPABASE, "hero");
    expect(out).toContain("width=1600");
    expect(out).toContain("quality=80");
  });

  it("preserves existing query string", () => {
    const out = getImageUrl(`${SUPABASE}?t=123`, "cover");
    expect(out).toContain("?t=123&width=1200");
  });
});
