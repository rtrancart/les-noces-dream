# Alignement Axeptio sur le snippet officiel (Consent Mode v2 natif)

## Objectif

Faire piloter le Google Consent Mode v2 nativement par Axeptio via son bloc `googleConsentMode.default`, supprimer le double pilotage actuel dans `index.html` et dans le composant React, et corriger la version des cookies Axeptio.

## État actuel confirmé

- `index.html` charge : (1) snippet Axeptio avec `cookiesVersion: "lesnoces-fr"`, (2) bloc autonome `gtag('consent','default', ...)` avec les 4 signaux `denied` et `wait_for_update: 500`, (3) snippet GTM `GTM-5845GQJR`.
- `src/components/ConsentManager.tsx` écoute `cookies:complete` et `ready`, appelle `gtag('consent','update', ...)` puis pousse `consent_update` dans le `dataLayer`.
- `src/vite-env.d.ts` type `axeptioSettings` avec `clientId`, `cookiesVersion` et `[key: string]: unknown`.
- `.env.example` déclare `VITE_AXEPTIO_CLIENT_ID`.

## Résultats attendus

### 1. `index.html` — snippet Axeptio officiel

Remplacer le bloc Axeptio actuel par le snippet officiel :

```text
window.axeptioSettings = {
  clientId: "%VITE_AXEPTIO_CLIENT_ID%",
  cookiesVersion: "3dca1c47-d90b-43a2-b8e6-22723d56f121",
  googleConsentMode: {
    default: {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      wait_for_update: 500
    }
  }
};
```

Le loader statique (`static.axept.io/sdk.js`) reste identique. Si `VITE_AXEPTIO_CLIENT_ID` est vide ou non résolu, le snippet ne doit pas être injecté.

### 2. `index.html` — suppression du bloc Consent Mode v2 autonome

Supprimer le bloc `<script>` actuel (lignes 27-39) qui appelle `gtag('consent','default', ...)`. Conserver néanmoins une définition minimale de `window.dataLayer` et de `window.gtag` juste avant le snippet GTM, car le code applicatif et GTM s'appuient sur `gtag`. Ce bloc ne contient plus aucun appel `consent`.

### 3. `index.html` — ordre de chargement final

```text
1. Axeptio (avec googleConsentMode.default)
2. Définition dataLayer + gtag (sans consent default)
3. Google Tag Manager (snippet inchangé)
```

### 4. `src/components/ConsentManager.tsx` — allègement

- Supprimer l'appel `gtag('consent','update', ...)` : Axeptio le gère nativement.
- Conserver l'écoute des événements Axeptio (`ready`, `cookies:complete`) et le push dans le `dataLayer` de l'événement `consent_update` avec les variables `consent_analytics`, `consent_ads`, `consent_meta`, pour permettre à GTM de déclencher le Meta Pixel et tout autre tag non couvert par le Consent Mode Google.
- Mettre à jour le commentaire en haut du fichier pour refléter le nouveau rôle.
- Le composage reste sans rendu visible (`return null`) et monté au plus haut dans `src/App.tsx`.

### 5. Types TypeScript

Dans `src/vite-env.d.ts`, typer explicitement `googleConsentMode` dans `axeptioSettings` tout en conservant la compatibilité avec les propriétés supplémentaires.

## Détails techniques

- Fichiers modifiés : `index.html`, `src/components/ConsentManager.tsx`, `src/vite-env.d.ts`.
- Fichiers non modifiés : `.env.example`, `src/App.tsx`, `src/hooks/useTracking.ts`, conteneur GTM, consentement marketing Brevo, tracking `evenements_prestataire`.
- Vérification : `bunx tsc --noEmit`.
- Déploiement : publier après validation ; la valeur réelle de `VITE_AXEPTIO_CLIENT_ID` est déjà renseignée côté hébergement.

## Hors périmètre

- Conteneur GTM et events `useTracking` existants.
- Canal GA4 direct (`VITE_GA4_ID`).
- Consentement marketing Brevo (`consentement_marketing`).
- Tracking `evenements_prestataire` (intérêt légitime).
