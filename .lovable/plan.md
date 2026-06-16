# Phase 9 SEO — Finalisation

## Étape 1 — Variable `VITE_SITE_URL`

**`.env`** : ajouter
```
VITE_SITE_URL="https://id-preview--0e72174c-74d1-4db3-9e26-0b8167e53603.lovable.app"
```
À changer en `https://lesnoces.net` lors de la bascule DNS.

**`src/lib/seo.ts`** : remplacer
```ts
const SITE_ORIGIN_DEFAULT = "https://lesnoces.net";

function resolveOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : SITE_ORIGIN_DEFAULT;
}
```
par une lecture de `import.meta.env.VITE_SITE_URL`, avec fallback `window.location.origin` côté client puis chaîne vide pour forcer une erreur visible côté SSR/test si la variable manque. `resolveAbsoluteUrl()`, `SeoHead`, `JsonLd` et `buildSeoMeta` consomment déjà la valeur — aucun autre fichier touché.

## Étape 2 — Edge Function `generate-sitemap`

**`supabase/functions/generate-sitemap/index.ts`** :
- Remplacer `const SITE_URL = "https://lesnoces.net";` par `const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://lesnoces.net";` (le secret `PUBLIC_SITE_URL` existe déjà).
- Réordonner la construction du tableau `urls` selon : statiques → régions → catégories mères → catégories filles → articles → prestataires. Un seul `urls.push` par bloc, dans cet ordre, pour un fichier déterministe entre deux appels.
- Aucune autre modification (logique, filtres, cache restent identiques).
- Redéploiement de la function après modification.

## Étape 3 — `public/robots.txt`

Remplacer la dernière ligne
```
Sitemap: https://lesnoces.net/sitemap.xml
```
par
```
Sitemap: https://egbohbwiywgyyculswvf.supabase.co/functions/v1/generate-sitemap
# URL directe de l'Edge Function Supabase. À remplacer par https://lesnoces.net/sitemap.xml
# après ajout d'un rewrite Vercel /sitemap.xml → Edge Function (à faire lors de la bascule DNS).
```
Tous les blocs `User-agent:` / `Allow:` / `Disallow:` au-dessus restent strictement inchangés.

## Étape 4 — Audit `SeoHead` routes publiques

Lecture (pas de refonte) pour vérifier 3 points sur chaque route :
1. Présence d'un `<SeoHead>`.
2. `canonicalUrl` self-référent (path exact de la route, jamais `/`).
3. `title`/`description` spécifiques à la page, et pour les listes : pas de query-string dans le canonical.

Routes auditées :
- `/cgu`, `/mentions-legales`, `/confidentialite`, `/page/:slug` → toutes servies par `PageContenu` (déjà avec `canonicalUrl={`/${page.slug}`}` et `meta_title`/`meta_description` issus de la DB). Confirmer que chaque slug en DB a bien un meta_title/meta_description distinct ; sinon, fallback déjà en place `${titre} | LesNoces.net`.
- `/recherche` (`src/pages/Recherche.tsx`) → vérifier que `canonicalUrl` passé à `<SeoHead>` est la chaîne littérale `"/recherche"` et **n'inclut pas** `location.search` ni `useSearchParams()`. Corriger si nécessaire (1 ligne).
- `/prestataires/:slugMere` et `/prestataires/:slugMere/:slug2` (`PrestatairesListe.tsx`) → canonical avec les 1 ou 2 segments selon le cas.
- Pages déjà auditées en Phase 9 initiale (Index, FichePrestataire, MariageRegion, Blog, BlogArticle, NotFound, etc.) : vérification rapide canonical self-référent uniquement.

Aucun changement structurel sur les composants. Corrections uniquement si un canonical pointe vers `/` au lieu de la route, ou si un query-string pollue le canonical.

## Étape 5 — Vérifications

- `bunx vitest run src/lib/seoAllPages.test.tsx src/lib/seoHelper.test.tsx` (s'assurer qu'aucun test ne dépend du `SITE_ORIGIN_DEFAULT` hardcodé — adapter si besoin pour mocker `import.meta.env.VITE_SITE_URL`).
- Curl manuel de l'Edge Function via `supabase--curl_edge_functions` après déploiement, pour confirmer que les `<loc>` portent bien le domaine attendu et que l'ordre est respecté.

## Hors scope

Prerendering Vercel, webhook revalidation, rewrite Vercel `/sitemap.xml`, SSR, i18n, srcset/sizes, back-office, schéma DB.

## Ordre de livraison

1. `.env` + `src/lib/seo.ts`.
2. Edge Function : `PUBLIC_SITE_URL` + tri stable, puis déploiement.
3. `public/robots.txt`.
4. Audit routes (`Recherche.tsx` en priorité — risque réel de pollution canonical par les query-strings de filtres).
5. Tests Vitest + curl Edge Function.
