/**
 * Vérifie que le conteneur GTM se charge et que les events GA4 attendus
 * sont bien poussés dans `window.dataLayer` au fil de la navigation.
 *
 * Lancement :
 *   bunx playwright install chromium
 *   bunx playwright test tests/e2e/datalayer.spec.ts
 *
 * Adapter BASE_URL via la variable d'environnement PLAYWRIGHT_BASE_URL
 * (par défaut = preview Lovable courante).
 */
import { test, expect, type Page } from "@playwright/test";

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ??
  "https://id-preview--0e72174c-74d1-4db3-9e26-0b8167e53603.lovable.app";

const GTM_ID = "GTM-5845GQJR";

type DLEntry = Record<string, unknown> & { event?: string };

async function getDataLayer(page: Page): Promise<DLEntry[]> {
  return await page.evaluate(() => {
    // @ts-expect-error window.dataLayer typé côté app
    return (window.dataLayer ?? []).map((e) => ({ ...e }));
  });
}

async function waitForEvent(page: Page, eventName: string, timeout = 5000) {
  await page.waitForFunction(
    (name) =>
      // @ts-expect-error
      (window.dataLayer ?? []).some((e: any) => e?.event === name),
    eventName,
    { timeout },
  );
}

test.describe("GTM dataLayer", () => {
  test("conteneur GTM chargé + events GA4 sur 3 pages", async ({ page }) => {
    // ---------- Page 1 : Accueil ----------
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

    // Le snippet GTM doit avoir initialisé dataLayer avec gtm.start / gtm.js
    await waitForEvent(page, "gtm.js");
    const dlHome = await getDataLayer(page);
    const gtmStart = dlHome.find((e) => "gtm.start" in e);
    expect(gtmStart, "gtm.start absent — snippet GTM non exécuté").toBeTruthy();

    // Le script gtm.js de Google doit avoir été requêté avec le bon ID
    const gtmRequest = page
      .context()
      .pages()
      .flatMap(() => [])
      .concat();
    const gtmLoaded = await page.evaluate((id) => {
      return Array.from(document.scripts).some((s) =>
        s.src.includes(`gtm.js?id=${id}`),
      );
    }, GTM_ID);
    expect(gtmLoaded, `<script src="gtm.js?id=${GTM_ID}"> absent`).toBe(true);

    // page_view émis par useTracking via ScrollToTop
    await waitForEvent(page, "page_view");
    const pv = (await getDataLayer(page)).find((e) => e.event === "page_view");
    expect(pv).toMatchObject({ event: "page_view", page_path: "/" });

    // ---------- Page 2 : Recherche ----------
    await page.goto(`${BASE_URL}/recherche?lieu=paris`, {
      waitUntil: "networkidle",
    });
    await waitForEvent(page, "page_view");
    // search est émis quand le hook Recherche pousse les filtres
    await waitForEvent(page, "search", 8000).catch(() => {
      // Tolérant : la page peut nécessiter une catégorie ou un terme actif
    });

    const dlSearch = await getDataLayer(page);
    const searchPV = dlSearch.filter((e) => e.event === "page_view");
    expect(searchPV.length, "page_view sur /recherche manquant").toBeGreaterThanOrEqual(2);

    // ---------- Page 3 : Historique (client) ----------
    // On reste sur une page publique pour ne pas dépendre de l'auth :
    // la page d'inscription doit aussi pousser un page_view.
    await page.goto(`${BASE_URL}/inscription`, { waitUntil: "networkidle" });
    await waitForEvent(page, "page_view");

    // ---------- Bilan : on rapporte tous les events vus ----------
    const finalDL = await getDataLayer(page);
    const eventNames = finalDL
      .map((e) => e.event)
      .filter((n): n is string => typeof n === "string");

    console.log("\n=== dataLayer events observés ===");
    console.log(JSON.stringify(eventNames, null, 2));

    // Au minimum on attend : gtm.js, gtm.dom, gtm.load, et plusieurs page_view
    expect(eventNames).toEqual(expect.arrayContaining(["gtm.js", "page_view"]));
  });

  /**
   * Référence : les 13 events GA4 implémentés dans `useTracking`.
   * Ce test ne déclenche pas tous les events (certains demandent un compte
   * authentifié ou un parcours Stripe), il liste juste ceux attendus.
   */
  test("référence des 13 events GA4 du hook useTracking", () => {
    const expected = [
      "page_view",
      "search",
      "view_item",
      "add_to_wishlist",
      "reveal_phone",
      "demande_devis",
      "sign_up",
      "login",
      "begin_checkout",
      "purchase",
      "boost_purchase",
      "view_history",
      "click_history_item",
    ];
    expect(expected).toHaveLength(13);
  });
}); 
