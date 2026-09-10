import { useEffect } from "react";

/**
 * ConsentManager — couche applicative d'écoute de la CMP Axeptio.
 *
 * Le Google Consent Mode v2 est piloté nativement par Axeptio
 * (bloc `googleConsentMode.default` dans `index.html`). Ce composant ne
 * met donc pas à jour les signaux Google lui-même.
 *
 * Sa seule responsabilité est de pousser un événement `consent_update`
 * dans le `dataLayer` à chaque décision utilisateur, afin que GTM puisse
 * déclencher les tags non couverts par le Consent Mode Google.
 *
 * En mode Google Consent Mode natif, Axeptio transmet un objet
 * `$$googleConsentMode` contenant directement les signaux :
 *  - analytics_storage
 *  - ad_storage
 *  - ad_user_data
 *  - ad_personalization
 *
 * Mapping poussé dans `consent_update` :
 *  - analytics_storage === "granted" → consent_analytics
 *  - ad_storage      === "granted" → consent_ads
 *
 * Le choix est mémorisé par Axeptio (cookie propre). La navigation SPA ne
 * réinitialise rien : l'abonnement est posé une seule fois au montage.
 */
export default function ConsentManager() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const pushConsentUpdate = (choices: Record<string, unknown> | undefined) => {
      const gcm = (choices?.$$googleConsentMode as Record<string, unknown>) ?? {};

      const analytics = gcm.analytics_storage === "granted";
      const ads = gcm.ad_storage === "granted";

      const granted = (v: boolean) => (v ? "granted" : "denied");

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "consent_update",
        consent_analytics: granted(analytics),
        consent_ads: granted(ads),
      });
    };

    window._axcb = window._axcb || [];
    window._axcb.push((sdk: any) => {
      // Choix déjà enregistrés lors d'un précédent passage (ou rechargement).
      sdk.on("ready", (choices: Record<string, unknown>) => pushConsentUpdate(choices));
      // Nouvelle décision de l'utilisateur.
      sdk.on("cookies:complete", (choices: Record<string, unknown>) =>
        pushConsentUpdate(choices),
      );
    });
  }, []);

  return null;
}
