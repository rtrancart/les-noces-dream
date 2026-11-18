import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { isCssResponse, preserveSnapshotStyles, resolveCssUrls } from "../../supabase/functions/_shared/prerender-styles";

describe("prerender CSS resources", () => {
  // jsdom's AbortSignal lacks timeout; production Deno provides it.
  beforeAll(() => vi.stubGlobal("AbortSignal", { timeout: () => new AbortController().signal }));
  afterAll(() => vi.unstubAllGlobals());
  it("resolves relative CSS resources against their original stylesheet, not the page", () => {
    expect(resolveCssUrls('a{background:url(./photo.webp)}', "https://lesnoces.net/assets/index-old.css"))
      .toBe('a{background:url("https://lesnoces.net/assets/photo.webp")}');
    expect(resolveCssUrls('@import "../fonts.css";a{mask:url(data:image/png;base64,abc)}', "https://lesnoces.net/assets/index-old.css"))
      .toBe('@import "https://lesnoces.net/fonts.css";a{mask:url("data:image/png;base64,abc")}');
  });

  it("requires a successful text/css response, rejecting HTML fallbacks and missing assets", () => {
    expect(isCssResponse(new Response("css", { headers: { "content-type": "text/css; charset=utf-8" } }))).toBe(true);
    expect(isCssResponse(new Response("missing", { status: 404, headers: { "content-type": "text/css" } }))).toBe(false);
    expect(isCssResponse(new Response("html", { headers: { "content-type": "text/html" } }))).toBe(false);
  });

  it("uses the published main stylesheet only when the old bundle is unavailable", async () => {
    const load = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("missing", { status: 404 }))
      .mockResolvedValueOnce(new Response('<link rel="stylesheet" href="/assets/index-new.css">'))
      .mockResolvedValueOnce(new Response("a{}", { headers: { "content-type": "text/css" } }));
    await preserveSnapshotStyles('<link rel="stylesheet" href="/assets/index-old.css">', "https://lesnoces.net", load);
    expect(load.mock.calls.map(([url]) => url)).toEqual([
      "https://lesnoces.net/assets/index-old.css", "https://lesnoces.net/index.html", "https://lesnoces.net/assets/index-new.css",
    ]);
  });

  it("does not consult the current publication when captured CSS is available", async () => {
    const load = vi.fn<typeof fetch>().mockResolvedValue(new Response("a{}", { headers: { "content-type": "text/css" } }));
    await preserveSnapshotStyles('<link rel="stylesheet" href="/assets/index-old.css">', "https://lesnoces.net", load);
    expect(load.mock.calls.map(([url]) => url)).toEqual(["https://lesnoces.net/assets/index-old.css"]);
  });

  it("rejects unavailable secondary CSS rather than substituting unrelated styles", async () => {
    const load = vi.fn<typeof fetch>().mockResolvedValue(new Response("missing", { status: 404 }));
    await expect(preserveSnapshotStyles('<link rel="stylesheet" href="/assets/gallery-old.css">', "https://lesnoces.net", load))
      .rejects.toThrow("Snapshot stylesheet unavailable");
    expect(load).toHaveBeenCalledTimes(1);
  });
});