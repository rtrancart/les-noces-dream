import { supabase } from "@/integrations/supabase/client";

let ga4Loaded = false;

/**
 * Dynamically inject GA4 script if VITE_GA4_ID is set.
 * Call once at app startup.
 */
export function initGA4() {
  const id = import.meta.env.VITE_GA4_ID;
  if (!id) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: any[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", id);

  ga4Loaded = true;
}

/**
 * Track an event to GA4 (if loaded) and/or Supabase evenements_prestataire.
 *
 * @param name        - Event name (e.g. "vue_profil", "recherche")
 * @param params      - Optional GA4 event parameters
 * @param prestataireId - If provided, also inserts into evenements_prestataire
 */
export function trackEvent(
  name: string,
  params?: Record<string, unknown>,
  prestataireId?: string
) {
  // GA4
  if (ga4Loaded && window.gtag) {
    window.gtag("event", name, params ?? {});
  }

  // Supabase (fire-and-forget)
  if (prestataireId) {
    supabase
      .from("evenements_prestataire")
      .insert({ prestataire_id: prestataireId, type: name })
      .then();
  }
}
