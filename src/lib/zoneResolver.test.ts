import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveZoneSlug, ZoneApiError } from "./zoneResolver";
import type { ZoneRefRow } from "@/contexts/ZonesContext";

const emptyIndex = new Map<string, ZoneRefRow>();

/** Build a fetch Response-like object. */
function jsonRes(body: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

/** A fetch impl that never resolves until aborted (simulates timeout). */
function neverResolves(): (input: any, init?: any) => Promise<Response> {
  return (_input, init) =>
    new Promise((_resolve, reject) => {
      const signal: AbortSignal | undefined = init?.signal;
      if (signal) {
        signal.addEventListener("abort", () => {
          const err = new Error("Aborted");
          (err as any).name = "AbortError";
          reject(err);
        });
      }
    });
}

describe("resolveZoneSlug — retry & timeout logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("aborts the first attempt after 3s, waits 1s, then retries with a fresh 3s timeout (success on retry)", async () => {
    let call = 0;
    const fetchMock = vi.fn((input: any, init?: any) => {
      call++;
      if (call === 1) {
        return neverResolves()(input, init);
      }
      return Promise.resolve(
        jsonRes([
          {
            nom: "Paris",
            code: "75056",
            codeRegion: "11",
            codeDepartement: "75",
            centre: { coordinates: [2.3522, 48.8566] },
          },
        ])
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = resolveZoneSlug("paris", emptyIndex);

    // First attempt: should not have completed yet
    await vi.advanceTimersByTimeAsync(2999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 3s timeout fires → AbortError → wait 1s pause
    await vi.advanceTimersByTimeAsync(1); // total 3000ms → abort
    // Pause 1s before retry
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); // pause done → retry fires
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result?.type).toBe("ville");
    expect(result?.label).toBe("Paris");
  });

  it("throws ZoneApiError after retry also times out (total ~7s)", async () => {
    const fetchMock = vi.fn(neverResolves());
    vi.stubGlobal("fetch", fetchMock);

    const promise = resolveZoneSlug("villeinconnue", emptyIndex);
    // Surface rejection without unhandled warning
    const caught = promise.catch((e) => e);

    // Advance through: 3s (1st timeout) + 1s pause + 3s (2nd timeout)
    await vi.advanceTimersByTimeAsync(7000);
    await vi.runAllTimersAsync();

    const err = await caught;
    expect(err).toBeInstanceOf(ZoneApiError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on a 4xx response (treated as genuine miss)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonRes({}, 404)));
    vi.stubGlobal("fetch", fetchMock);

    const promise = resolveZoneSlug("zzz-not-retried", emptyIndex);
    const caught = promise.catch((e) => e);

    await vi.runAllTimersAsync();

    const err = await caught;
    expect(err).toBeInstanceOf(ZoneApiError);
    expect((err as ZoneApiError).retryable).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once on a 5xx response (retryable)", async () => {
    let call = 0;
    const fetchMock = vi.fn(() => {
      call++;
      if (call === 1) return Promise.resolve(jsonRes({}, 503));
      return Promise.resolve(
        jsonRes([
          {
            nom: "Lyon",
            code: "69123",
            codeRegion: "84",
            codeDepartement: "69",
            centre: { coordinates: [4.85, 45.75] },
          },
        ])
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = resolveZoneSlug("lyon-5xx", emptyIndex);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result?.label).toBe("Lyon");
  });
});

describe("resolveZoneSlug — fallback signal for caller", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("after retry failure, throws a ZoneApiError so the page can activate the approximate text-search fallback", async () => {
    const fetchMock = vi.fn(neverResolves());
    vi.stubGlobal("fetch", fetchMock);

    const promise = resolveZoneSlug("ville-down", emptyIndex);
    const caught = promise.catch((e) => e);
    await vi.advanceTimersByTimeAsync(7000);
    await vi.runAllTimersAsync();

    const err = await caught;
    // Page-level contract: ZoneApiError → setFallbackSlug(slug2) → ILIKE %slug% query
    expect(err).toBeInstanceOf(ZoneApiError);
  });
});
