# Consentement cookies : Axeptio + Consent Mode v2

Objectif : bloquer par défaut les traceurs tiers (GA4, Google Ads, Meta) tant
que le visiteur n'a pas donné son accord, via le widget Axeptio.

## Ce qui change

### 1. Ordre de chargement dans `index.html`

Trois blocs en tête du `<head>`, dans cet ordre strict :

```text
a. axeptioSettings + loader Axeptio   (clientId depuis l'environnement,
                                       cookiesVersion "lesnoces-fr")
b. Consent Mode v2 : tous les signaux à "denied", wait_for_update 500 ms
c. Snippet GTM existant (GTM-5845GQJR), inchangé, déplacé après a et b
```

Le conteneur GTM n'est ni dupliqué ni modifié : il est simplement précédé de
la CMP et du Consent Mode. Le `<noscript>` GTM reste dans le `<body>`.

Signaux mis à `denied` par défaut : `ad_storage`, `analytics_storage`,
`ad_user_data`, `ad_personalization`.

### 2. Couche applicative d'écoute des choix

Un composant sans aucun rendu visible, monté tout en haut de l'application
(au-dessus du routeur), donc actif dès le premier chargement et sur toutes les
pages. À chaque décision de l'utilisateur dans le widget Axeptio :

- Mise à jour Google via `gtag('consent','update', ...)` :
  - catégorie `google_analytics` → `analytics_storage`
  - catégorie `google_ads` → `ad_storage` + `ad_user_data` + `ad_personalization`
- Push dans le `dataLayer` d'un événement `consent_update` portant l'état des
  trois catégories (`analytics`, `ads`, `meta`). La catégorie `meta` sert au
  déclenchement du Meta Pixel côté conteneur GTM.

L'interface de consentement reste entièrement gérée par le widget Axeptio.

### 3. Robustesse SPA

Le choix est mémorisé par Axeptio (son propre cookie) et l'écoute est
enregistrée une seule fois au montage de l'application. Une navigation côté
client ne réinitialise donc rien et ne fait pas réapparaître le bandeau ;
celui-ci ne revient que si aucun choix n'a été fait, ou si le visiteur rouvre
volontairement ses préférences.

### 4. Variable d'environnement

`VITE_AXEPTIO_CLIENT_ID` déclarée dans un fichier d'exemple d'environnement
avec une valeur placeholder. La vraie valeur sera renseignée côté hébergement.

## Détails techniques

- `index.html` : les blocs a/b/c sont placés immédiatement après les
  `preconnect` (ajout d'un `preconnect` vers `static.axept.io`). Le `clientId`
  est injecté au build via le placeholder Vite `%VITE_AXEPTIO_CLIENT_ID%` dans
  l'objet `axeptioSettings` ; si le placeholder est vide, le loader n'est pas
  injecté et le Consent Mode reste en `denied` (aucun traceur tiers).
- Le bloc b définit `window.dataLayer` et la fonction `gtag` avant l'appel
  `gtag('consent','default',{...,'wait_for_update':500})`, conformément à la
  spécification Google.
- Nouveau `src/components/ConsentManager.tsx` : `useEffect` unique qui empile
  un callback dans `window._axcb` et s'abonne à `axeptio_sdk.on('cookies:complete')`
  pour lire les choix, puis appelle `gtag('consent','update', ...)` et pousse
  `consent_update`. Retourne `null`.
- Monté dans `src/App.tsx` à l'intérieur de `TooltipProvider`, au-dessus de
  `BrowserRouter`, hors de toute route.
- `src/vite-env.d.ts` : ajout des déclarations `axeptioSettings` et `_axcb`
  sur `Window` (le `dataLayer` et `gtag` y sont déjà déclarés).
- Nouveau `.env.example` avec `VITE_AXEPTIO_CLIENT_ID="votre-client-id-axeptio"`
  (le `.env` réel, auto-géré, n'est pas modifié).

## Hors périmètre (inchangé)

- Conteneur GTM et events `useTracking` existants.
- Canal GA4 direct : `VITE_GA4_ID` reste non défini.
- Consentement marketing Brevo (`consentement_marketing`).
- Tracking `evenements_prestataire` (intérêt légitime, non soumis au consentement).

## Vérification

- `bunx tsc --noEmit`
- Contrôle de l'ordre des trois blocs dans le HTML servi et de l'absence de
  rendu visible ajouté par le composant.
