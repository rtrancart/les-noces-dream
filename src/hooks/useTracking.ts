/**
 * useTracking — Hook centralisé de tracking GTM/GA4 (dataLayer).
 *
 * Architecture :
 *  - Pousse exclusivement dans `window.dataLayer` (architecture GTM standard).
 *  - Noms d'events conformes GA4 (anglais).
 *  - Aucune donnée nominative (email/nom/téléphone) ne doit transiter par dataLayer.
 *    Ces données restent côté Supabase uniquement.
 *  - Les stats first-party (table `evenements_prestataire`) restent gérées
 *    en parallèle par `lib/analytics.ts#trackEvent` — deux responsabilités distinctes.
 */

// `window.dataLayer` est déjà déclaré (any[]) dans src/lib/analytics.ts.

function push(event: string, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...payload });
}

export function useTracking() {
  return {
    /** Vue de page (à appeler sur changement de route). */
    trackPageView: (page_path: string, page_title: string) =>
      push("page_view", { page_path, page_title }),

    /**
     * Recherche prestataires.
     * @param search_term            Slugs géographiques en kebab-case, séparés par virgule.
     * @param opts.search_type       "city_radius" (ville + rayon) | "zones" (régions/départements).
     * @param opts.search_category   Slug catégorie (optionnel).
     * @param opts.search_radius     Rayon en km (uniquement pour search_type="city_radius").
     */
    trackSearch: (
      search_term: string,
      opts: {
        search_type: "city_radius" | "zones";
        search_category?: string;
        search_radius?: number;
      },
    ) =>
      push("search", {
        search_term,
        search_type: opts.search_type,
        ...(opts.search_category ? { search_category: opts.search_category } : {}),
        ...(opts.search_type === "city_radius" && typeof opts.search_radius === "number"
          ? { search_radius: opts.search_radius }
          : {}),
      }),

    /** Affichage fiche prestataire. */
    trackViewItem: (item_id: string, item_category?: string) =>
      push("view_item", { item_id, ...(item_category ? { item_category } : {}) }),

    /** Ajout aux favoris. */
    trackAddToWishlist: (item_id: string) =>
      push("add_to_wishlist", { item_id }),

    /** Révélation du numéro de téléphone. */
    trackRevealPhone: (item_id: string) =>
      push("reveal_phone", { item_id }),

    /**
     * Envoi d'une demande de devis.
     * @param event_type    mariage | evenement_entreprise | cocktail | autre
     * @param has_account   true si le visiteur était connecté au moment de l'envoi.
     * @param budget        Budget indicatif renseigné (optionnel).
     */
    trackDemandeDevis: (
      item_id: string,
      event_type: string,
      has_account: boolean,
      budget?: string | number,
    ) =>
      push("demande_devis", {
        item_id,
        event_type,
        has_account,
        ...(budget !== undefined && budget !== "" ? { budget } : {}),
      }),

    /** Inscription. */
    trackSignUp: (method: string, role: "client" | "prestataire") =>
      push("sign_up", { method, role }),

    /** Connexion. */
    trackLogin: (method: string) =>
      push("login", { method }),

    /** Début de checkout abonnement. */
    trackBeginCheckout: (pack: string, value: number, currency = "EUR") =>
      push("begin_checkout", { pack, value, currency }),

    /** Achat abonnement confirmé. */
    trackPurchase: (
      pack: string,
      value: number,
      transaction_id: string,
      currency = "EUR",
    ) => push("purchase", { pack, value, currency, transaction_id }),

    /** Achat d'un boost. */
    trackBoostPurchase: (pack: string, value: number, currency = "EUR") =>
      push("boost_purchase", { pack, value, currency }),

    /** Ouverture / affichage de l'historique. */
    trackViewHistory: (nb_items: number) =>
      push("view_history", { nb_items }),

    /**
     * Clic sur un item de l'historique.
     * @param source  "dropdown" | "page"
     */
    trackClickHistoryItem: (
      item_id: string,
      item_position: number,
      source: "dropdown" | "page",
    ) => push("click_history_item", { item_id, item_position, source }),
  };
}
