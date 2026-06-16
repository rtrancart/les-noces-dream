# Phase 10 — Core Web Vitals

Cibles : LCP < 2.5s, CLS < 0.1, INP < 100ms sur pages publiques.

Prérequis confirmé : Supabase Pro → image renderer (`/storage/v1/render/image/public/...`) disponible. Helper avec fallback noop pour URLs non-Supabase.

## Tâche 1 — Helper centralisé `src/lib/images.ts`

```ts
type Preset = "cover" | "thumb" | "hero";
// cover : fiche presta plein format (width 1200, q 80)
// thumb : cards listing, galerie secondaire (width 400, q 75)
// hero  : article blog / bannière (width 1600, q 80)

export function getImageUrl(url: string | null | undefined, preset: Preset): string
```

Logique :
1. URL falsy → `""`.
2. URL non-Supabase Storage (pas de `/storage/v1/object/public/`) → retournée telle quelle.
3. Sinon : remplace `/object/public/` par `/render/image/public/` + `?width=…&quality=…`. Pas de `format=webp` forcé : Supabase sert WebP via content-negotiation (Accept header), ce qui évite de casser les vieux Safari.

Tests `src/lib/images.test.ts` : URL Supabase → réécrite ; URL externe → inchangée ; null → "".

## Tâche 2 — Image LCP fiche prestataire

`src/components/fiche/FicheGalerie.tsx` :
- `images` mappé via `getImageUrl(img, i === 0 ? "cover" : "thumb")`.
- `images[0]` (desktop ET mobile) : `loading="eager"` + `fetchPriority="high"` + `decoding="async"`.
- Autres : `loading="lazy"` + `decoding="async"`.
- Lightbox : `loading="eager"` (déclenché par interaction).

`FichePrestataire.tsx` : aucun changement (galerie encapsulée).

## Tâche 3 — Lazy partout ailleurs (`loading="lazy"` + `decoding="async"` + `getImageUrl(..., "thumb")`)

- `src/components/search/ProviderCard.tsx`
- `src/components/blog/ArticleTile.tsx`
- `src/components/HistoriqueList.tsx`, `src/components/historique/HistoriqueByCategory.tsx`
- `src/pages/Index.tsx` (catégories / vignettes home)
- `src/pages/Blog.tsx`
- `src/pages/BlogArticle.tsx` → `image_couverture_url` en preset `hero` + `loading="eager"` + `fetchPriority="high"` (LCP de l'article)
- `src/pages/client/Favoris.tsx`, `src/pages/client/Dashboard.tsx`
- `src/pages/MariageRegion.tsx`, `src/pages/PrestatairesListe.tsx`, `src/pages/Recherche.tsx` (si `<img>` directes)
- `src/components/prestataire/WelcomeBanner.tsx`, `ProviderInfoBanner.tsx`, `PrestataireSidebar.tsx`

**Exclus (hors scope) :** `src/pages/admin/*`, `src/pages/prestataire/Galerie.tsx`, `src/pages/prestataire/Profil.tsx`, `PrestatairePhotosTab.tsx`.

Règle : **une seule image par page** avec `fetchPriority="high"` + `loading="eager"`. Sur les listings (Recherche, PrestatairesListe, Index, Blog index), aucune image n'est LCP → toutes en `lazy`.

## Tâche 4 — Preconnect `index.html`

Ajouter dans `<head>`, avant Google Fonts existant :

```html
<link rel="preconnect" href="https://egbohbwiywgyyculswvf.supabase.co" crossorigin />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="preconnect" href="https://www.googletagmanager.com" />
```

## Hors scope

- Pas de `srcset`/`sizes` (Phase 10.5 si nécessaire après mesure).
- Pas de modification fonctionnelle, uniquement attributs `<img>` et URLs.
- Pas de back-office.

## Ordre d'implémentation

1. `src/lib/images.ts` + tests.
2. `FicheGalerie.tsx` (LCP fiche presta).
3. `BlogArticle.tsx` (LCP article).
4. Composants listing (lazy + thumb).
5. `index.html` preconnect.
6. Vérif `browser--performance_profile` sur `/prestataire/:slug` et `/recherche` après déploiement.
