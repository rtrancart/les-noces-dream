# Audit lecture seule — Consentement & tracking (pré-CMP Axeptio)

Aucune modification. État de l'existant uniquement.

## 1. Ordre des scripts dans le `<head>` de `index.html`

Dans l'ordre exact :

1. `preconnect` Supabase, `fonts.googleapis.com`, `fonts.gstatic.com`, `googletagmanager.com`
2. Feuille Google Fonts (Playfair Display + Montserrat)
3. Deux blocs JSON-LD (`Organization`, `WebSite`)
4. **Snippet GTM** (`GTM-5845GQJR`) — injecté directement en dur, sans condition
5. Balises meta og:/twitter:

Constats :
- **Aucune initialisation Consent Mode v2** : pas de `gtag('consent','default', ...)` nulle part, ni avant ni après GTM.
- **Aucun script Axeptio**, aucun `axeptioSettings`, aucune référence à une CMP dans tout le code.
- Le `<noscript>` GTM est correctement placé dans le `<body>`.

## 2. Composant de gestion du consentement

**Il n'existe aucun composant CMP/consentement.**

Recherche exhaustive (`axeptio`, `consent`, `cmp`, `consent_update`, `gtag('consent'`) :
- Les seules occurrences de « consentement » concernent le **consentement marketing Brevo** (`consentement_marketing` sur `profiles`, case RGPD dans `Inscription.tsx`, retrait dans `client/Parametres.tsx` via RPC `definir_consentement_marketing`) — domaine CRM, rien à voir avec les cookies/traceurs.
- `OAuthConsent.tsx` concerne le consentement OAuth de l'app MCP — sans rapport.
- **Aucun** appel à `gtag('consent','update', ...)`, **aucun** push `consent_update` dans le dataLayer, **aucune** écoute d'événement CMP.

## 3. Variables d'environnement liées au tracking/consentement

- `VITE_GA4_ID` — lu dans `src/lib/analytics.ts` (`initGA4()`). **Non déclarée dans `.env`** : si absente, `initGA4()` ne fait rien (GA4 ne charge pas). Le `.env` actuel ne contient que les clés Supabase et `VITE_SITE_URL`.
- **Aucune variable d'identifiant client CMP** (type `AXEPTIO_CLIENT_ID`) n'existe ni n'est attendue par le code.

Note d'architecture : le tracking passe par **deux canaux** :
- GTM en dur dans `index.html` (charge GA4 via GTM côté conteneur, piloté par les events dataLayer de `useTracking.ts`)
- GA4 direct optionnel via `initGA4()` si `VITE_GA4_ID` est défini (aujourd'hui inactif)

## 4. Consent Mode v2 — signaux par défaut

**Non initialisé.** Aucun `gtag('consent','default')` n'existe. Il n'y a donc **aucun signal à `denied` par défaut** : GTM démarre sans état de consentement, et les tags configurés dans le conteneur GTM se comportent selon leur propre configuration (pas de garde côté site).

## Résumé

| Point | État |
|---|---|
| Consent Mode v2 `default` | Absent |
| Consent Mode v2 `update` / event `consent_update` | Absent |
| Script / settings Axeptio | Absent |
| Composant consentement cookies | Inexistant |
| Variable CMP (client ID, etc.) | Aucune attendue |
| GTM | En dur dans `index.html`, sans condition de consentement |
| GA4 direct (`VITE_GA4_ID`) | Prévu mais non configuré |
