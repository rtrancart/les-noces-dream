import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ConsentManager from "./ConsentManager";

afterEach(cleanup);

describe("ConsentManager", () => {
  it("maps chatgpt_pixel on ready and cookies:complete without changing Google consent", () => {
    window.dataLayer = [];
    window._axcb = [];
    render(<ConsentManager />);

    const handlers: Record<string, (choices: Record<string, unknown>) => void> = {};
    const register = window._axcb[0];
    expect(register).toBeTypeOf("function");
    register?.({ on: (event: string, handler: (choices: Record<string, unknown>) => void) => {
      handlers[event] = handler;
    } });
    expect(Object.keys(handlers)).toEqual(["ready", "cookies:complete"]);

    for (const event of ["ready", "cookies:complete"]) {
      for (const choice of [true, false, undefined]) {
        handlers[event]?.({
          chatgpt_pixel: choice,
          $$googleConsentMode: { analytics_storage: "granted", ad_storage: "denied" },
        });
        expect(window.dataLayer.at(-1)).toEqual({
          event: "consent_update",
          consent_analytics: "granted",
          consent_ads: "denied",
          consent_chatgpt_ads: choice === true ? "granted" : "denied",
        });
      }
    }
    expect(window.dataLayer).toHaveLength(6);
  });
});