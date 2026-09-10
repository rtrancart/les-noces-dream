# Correction de la lecture des choix Axeptio en mode Google Consent Mode natif

## Objectif

Corriger `src/components/ConsentManager.tsx` pour qu'il lise l'état du consentement dans la propriété `$$googleConsentMode` envoyée par Axeptio, au lieu des catégories `google_analytics` / `google_ads` / `meta` qui n'existent pas dans cette configuration.

## État actuel confirmé

- `src/components/ConsentManager.tsx` lit `choices.google_analytics`, `choices.google_ads` et `choices.meta`.
- Il pousse `consent_analytics`, `consent_ads` et `consent_meta` dans le `dataLayer` sous l'événement `consent_update`.
- Axeptio étant en mode Google Consent Mode natif, l'objet reçu contient `$$googleConsentMode` avec les signaux `analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization` (valeurs `"granted"` / `"denied"`).

## Résultats attendus

1. **Lecture depuis `$$googleConsentMode`**
   - Extraire `const gcm = choices?.$$googleConsentMode` (type `Record<string, unknown>`).
   - `consent_analytics` vaut `"granted"` si `gcm.analytics_storage === "granted"`, sinon `"denied"`.
   - `consent_ads` vaut `"granted"` si `gcm.ad_storage === "granted"`, sinon `"denied"`.

2. **Suppression de la catégorie Meta**
   - Retirer `consent_meta` du push `dataLayer`.
   - Retirer toute référence à `meta` dans le commentaire et le code.

3. **Aucun appel `gtag('consent','update')`**
   - Axeptio continue de piloter nativement les signaux Google.
   - Le composant se contente toujours de pousser `consent_update` dans le `dataLayer`.

4. **Mise à jour du commentaire d'en-tête**
   - Remplacer le bloc de documentation pour refléter le nouveau rôle : lecture de `$$googleConsentMode` et push de deux variables uniquement (`consent_analytics`, `consent_ads`).

## Détails techniques

- Fichier modifié : `src/components/ConsentManager.tsx`.
- Fichiers non modifiés : `index.html`, `src/vite-env.d.ts`, `.env.example`, `src/App.tsx`, `src/hooks/useTracking.ts`, GTM, Brevo, `evenements_prestataire`.
- Vérification : `bunx tsc --noEmit`.

## Hors périmètre

- Conteneur GTM et events `useTracking`.
- Canal GA4 direct (`VITE_GA4_ID`).
- Consentement marketing Brevo.
- Tracking `evenements_prestataire`.
- Configuration Axeptio dans `index.html`.
