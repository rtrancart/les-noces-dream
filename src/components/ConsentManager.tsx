import { useEffect } from "react";

/**
 * ConsentManager — couche applicative d'écoute de la CMP Axeptio.
 *
 * Le Google Consent Mode v2 est désormais piloté nativement par Axeptio
 * (bloc `googleConsentMode.default` dans `index.html`). Ce composant ne
 * met donc plus à jour les signaux Google lui-même.
 *
 * Sa seule responsabilité est de pousser un événement `consent_update`
 * dans le `dataLayer` à chaque décision utilisateur, afin que GTM puisse
 * déclencher les tags non couverts par le Consent Mode Google — en
 * particulier le Meta Pixel.
 *
 * Mapping des catégories Axeptio poussées dans `consent_update` :
 *  - google_analytics → consent_analytics
 *  - google_ads       → consent_ads
 *  - meta             → consent_meta
 *
 * Le choix est mémorisé par Axeptio (cookie propre). La navigation SPA ne
 * réinitialise rien : l'abonnement est posé une seule fois au montage.
 */
export default function ConsentManager() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const pushConsentUpdate = (choices: Record<string, unknown> | undefined) => {
      const c = choices ?? {};
      const analytics = c.google_analytics === true;
      const ads = c.google_ads === true;
      const meta = c.meta === true;

      const granted = (v: boolean) => (v ? "granted" : "denied");

      window.dataLayer = window.dataLayer || [];
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
      sdk.on("ready", (choices: Record<string, unknown>) => pushConsentUpdate(choices));
      // Nouvelle décision de l'utilisateur.
      sdk.on("cookies:complete", (choices: Record<string, unknown>) =>
        pushConsentUpdate(choices),
      );
    });
  }, []);

  return null;
}
