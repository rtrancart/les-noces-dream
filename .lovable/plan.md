# Plan SEO — LesNoces.net

Objectif : viser le top 1-2 sur les requêtes « [catégorie] mariage [ville/région] » et les requêtes de marque prestataire. Le blocage structurel n'est pas React en soi, mais le fait que le site est une SPA 100 % client : le HTML servi est vide, et tout le contenu (titres, textes, données prestataires) n'existe qu'après exécution du JavaScript.

## État constaté

- Aucun pré-rendu ni SSR actif : `vite.config.ts` est une configuration SPA standard, aucune dépendance SSR/SSG dans `package.json`.
- Les balises SEO sont posées côté client via `react-helmet-async` (`SeoHead`), donc invisibles pour les crawlers sociaux et fragiles pour les moteurs.
- `vercel.json` ne contient que des redirections 301 (reprise de l'ancien site) — pas de règle de rendu.
- Sitemap dynamique fonctionnel (Edge Function, fiches `statut = actif` uniquement), robots.txt correct.
- Le commentaire dans `SeoHead.tsx` évoquant un « snapshot Vercel » ne correspond à aucune configuration réelle.

## Phase 1 — Le socle : passer en rendu serveur

C'est le levier n°1, et sans lui les autres optimisations plafonnent. Deux options :

1. **Migrer vers le template SSR de Lovable (TanStack Start)** — recommandé. Le HTML est généré serveur : contenu, titres, métadonnées et JSON-LD sont lisibles par tous les crawlers, y compris les IA et les aperçus sociaux. C'est une migration structurelle du projet (routing et pages réécrits), à planifier comme un chantier à part entière.
2. **Pré-rendu par snapshot** — une Edge Function appelle un service de rendu externe, stocke le HTML dans le Storage, et Vercel sert ce HTML aux crawlers. Moins invasif mais c'est une brique à maintenir (fraîcheur, coût, ~3 300 fiches à re-rendre).

À trancher avant d'aller plus loin, car la Phase 2 s'implémente différemment selon le choix.

## Phase 2 — Métadonnées et données structurées par page

- Un `<title>` et une meta description uniques, écrits à la main par gabarit, pour chaque type de page : accueil, catégorie, catégorie + région, fiche prestataire, région, article de blog.
- Canonical auto-référencé sur chaque route, et canonical de `/recherche` filtré vers la page catégorie correspondante pour éviter la cannibalisation.
- JSON-LD par type de page : `LocalBusiness` (fiche prestataire, avec `aggregateRating` quand des avis existent), `BreadcrumbList`, `ItemList` sur les pages catégorie, `Article` sur le blog.
- Vérifier que `og:url` et canonical pointent bien sur la page elle-même.

## Phase 3 — Architecture de pages et maillage

C'est là que se gagnent les positions sur la longue traîne.

- Créer des pages croisées **catégorie × département/ville** (ex. `/prestataires/photographe-videaste/gironde`) : ce sont les requêtes réellement tapées. Une par couple ayant suffisamment de prestataires pour justifier une vraie page.
- Contenu propre à chaque page : introduction éditoriale, prestataires listés, fourchettes de prix, FAQ locale — jamais un texte dupliqué avec variable remplacée.
- Maillage interne : liens catégorie → sous-catégorie → page locale → fiches, et remontée depuis les fiches vers leurs pages parentes.
- Fiches prestataires : contenu réellement unique (les descriptions reprises de l'ancien site doivent être vérifiées contre la duplication).
- Étendre le sitemap aux nouvelles pages locales, et le segmenter en sitemap index si le volume dépasse ~10 000 URL.

## Phase 4 — Performance et Core Web Vitals

- Découpage du bundle par route (`React.lazy`) et allègement de la page d'accueil (vidéo hero en `preload="none"` + poster).
- Images prestataires servies en WebP/AVIF dimensionnées, `loading="lazy"` hors first-fold, `width`/`height` explicites pour éviter le CLS.
- Polices : `display=swap` déjà présent, préchargement du Playfair utilisé au-dessus de la ligne de flottaison.
- Mesure avant/après sur les 4 gabarits principaux.

## Phase 5 — Pilotage

- Search Console : suivi de l'indexation des nouvelles pages, correction des exclusions.
- Recherche de mots-clés (volumes et difficulté réels) avant d'ouvrir les pages locales, pour prioriser les couples catégorie/zone rentables.
- Contrôle des redirections 301 de l'ancien site : vérifier qu'aucune URL à trafic ne tombe en 404.

## Détails techniques

- Pages locales : nouvelle route `/prestataires/:categorie/:zone` alimentée par la table `zones_intervention` et la hiérarchie région/département déjà en place ; réutiliser le resolver `src/lib/zoneResolver.ts`.
- `generate-sitemap` : ajouter les combinaisons catégorie × zone au-dessus d'un seuil de prestataires actifs, et passer en `sitemapindex` si nécessaire.
- Retirer le commentaire trompeur sur le prérendu Vercel dans `src/components/SeoHead.tsx`.
- Ne rien changer aux redirections existantes de `vercel.json` sans vérification.

## Ordre proposé

Phase 1 (décision) → Phase 2 → Phase 3 → Phase 4 → Phase 5. Les phases 2 et 4 peuvent démarrer immédiatement même si la décision de Phase 1 est repoussée ; la Phase 3 n'a de valeur pleine qu'avec un rendu serveur.
