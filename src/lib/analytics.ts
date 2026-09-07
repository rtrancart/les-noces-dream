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

/* ------------------------------------------------------------------ */
/* Session de consultation d'une fiche prestataire                     */
/* ------------------------------------------------------------------ */

/**
 * Mesure silencieuse du temps réellement visible passé sur une fiche et
 * détection du rebond (aucune interaction significative).
 *
 * - Un identifiant de session est généré à chaque chargement de fiche
 *   (ni window, ni sessionStorage : une session = un affichage).
 * - Le temps en arrière-plan n'est pas compté.
 * - Envoi unique en fin de session via `navigator.sendBeacon` (fiable sur
 *   iOS Safari, contrairement à `beforeunload`).
 */
export function startFicheSession(prestataireId: string): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};

  const sessionId =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : null;
  if (!sessionId) return () => {};

  const startedAt = new Date().toISOString();
  let visibleSince = document.visibilityState === "visible" ? performance.now() : null;
  let visibleMs = 0;
  let interacted = false;
  let sent = false;

  const accumulate = () => {
    if (visibleSince !== null) {
      visibleMs += performance.now() - visibleSince;
      visibleSince = null;
    }
  };

  const markInteraction = () => {
    interacted = true;
  };

  const onScroll = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable > 0 && window.scrollY / scrollable > 0.25) markInteraction();
  };

  const onClick = (e: Event) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("a, button, [role='button'], img")) markInteraction();
  };

  const send = () => {
    if (sent) return;
    sent = true;
    accumulate();

    const payload = JSON.stringify({
      session_id: sessionId,
      prestataire_id: prestataireId,
      started_at: startedAt,
      duree_seconds: Math.round(visibleMs / 1000),
      rebond: !interacted,
      referrer: document.referrer || null,
    });

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/insert-session-fiche`;
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([payload], { type: "text/plain;charset=UTF-8" }));
      } else {
        void fetch(url, { method: "POST", body: payload, keepalive: true });
      }
    } catch {
      /* mesure best-effort : jamais bloquante pour l'utilisateur */
    }
  };

  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      accumulate();
      send();
    } else if (visibleSince === null) {
      visibleSince = performance.now();
    }
  };

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", send);
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("click", onClick, true);

  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", send);
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("click", onClick, true);
    send();
  };
}
