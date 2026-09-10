import { useEffect } from "react";

/**
 * ConsentManager — pont entre la CMP Axeptio et Google Consent Mode v2 / GTM.
 *
 * Ne rend rien : l'interface de consentement est entièrement gérée par le
 * widget Axeptio chargé dans index.html.
 *
 * À chaque décision de l'utilisateur :
 *  - met à jour les signaux Google via gtag('consent','update', ...)
 *  - pousse un événement `consent_update` dans le dataLayer pour que GTM
 *    puisse déclencher (ou non) ses tags — notamment le Meta Pixel.
 *
 * Mapping des catégories Axeptio :
 *  - google_analytics → analytics_storage
 *  - google_ads       → ad_storage + ad_user_data + ad_personalization
 *  - meta             → piloté côté GTM via l'événement consent_update
 *
 * Le choix est mémorisé par Axeptio (cookie propre). La navigation SPA ne
 * réinitialise rien : l'abonnement est posé une seule fois au montage.
 */
export default function ConsentManager() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const applyChoices = (choices: Record<string, unknown> | undefined) => {
      const c = choices ?? {};
      const analytics = c.google_analytics === true;
      const ads = c.google_ads === true;
      const meta = c.meta === true;

      const granted = (v: boolean) => (v ? "granted" : "denied");

      window.dataLayer = window.dataLayer || [];
      if (typeof window.gtag === "function") {
        window.gtag("consent", "update", {
          analytics_storage: granted(analytics),
          ad_storage: granted(ads),
          ad_user_data: granted(ads),
          ad_personalization: granted(ads),
        });
      }

      window.dataLayer.push({
        event: "consent_update",
        consent_analytics: granted(analytics),
        consent_ads: granted(ads),
        consent_meta: granted(meta),
      });
    };

    window._axcb = window._axcb || [];
    window._axcb.push((sdk: any) => {
      // Choix déjà enregistrés lors d'un précédent passage (ou rechargement).
      sdk.on("ready", (choices: Record<string, unknown>) => applyChoices(choices));
      // Nouvelle décision de l'utilisateur.
      sdk.on("cookies:complete", (choices: Record<string, unknown>) =>
        applyChoices(choices),
      );
    });
  }, []);

  return null;
}
