## Objectif

Aligner le rendu des visuels d'articles entre la page hub `/blog` et la page article, en supprimant l'impression de zoom/pixelisation constatée sur les tuiles.

## Changements

### 1. `src/components/blog/ArticleTile.tsx` — preset + ratio

- Remplacer `getImageUrl(url, "thumb")` par `getImageUrl(url, "cover")` (1200 px de large au lieu de 400 px). Les tuiles font 500-1000 px à l'écran : `cover` est le bon calibre, `thumb` est réservé aux miniatures type avatar/carte.
- Remplacer les hauteurs fixes `h-80` / `h-[420px]` par un **aspect-ratio** cohérent avec la page article :
  - `size="compact"` → `aspect-[4/5]` (portrait doux, adapté à la grille 3 col)
  - `size="default"` / `"large"` → `aspect-[4/5]` également, pour un cadrage vertical élégant proche du hero de l'article, plutôt qu'un paysage écrasé
- Conserver `object-cover` et l'effet `group-hover:scale-105` (ils ne sont pas en cause).

### 2. `src/pages/Blog.tsx` — cohérence de la featured (optionnel mais recommandé)

- Actuellement la featured utilise `h-[620px] object-cover` avec preset `hero` : nette mais cadrage paysage forcé. Basculer sur `aspect-[4/5] max-h-[620px]` pour rester dans la même famille de cadrage que le reste, sans perte de qualité.
- Laisser preset `hero` inchangé.

### 3. Rien à toucher côté page article

`BlogArticle.tsx` charge déjà en preset `hero` avec un cadrage cohérent — c'est la référence.

## Points techniques

- Le helper `getImageUrl` supporte déjà `cover` (1200 w / q80) — aucun ajout dans `src/lib/images.ts`.
- `aspect-[4/5]` est une classe Tailwind arbitraire déjà utilisée ailleurs (ex. `FicheGalerie`) — pas de config à modifier.
- Aucun impact backend, aucun impact sur les autres pages qui consomment `ArticleTile` (uniquement `Blog.tsx` et `BlogArticle.tsx` section « À lire ensuite »).

## Vérification

- Recharger `/blog` : les visuels des tuiles doivent être nets (plus d'upscale depuis 400 px) et présenter un cadrage vertical régulier.
- Ouvrir un article, comparer la couverture avec la vignette du même article dans « À lire ensuite » : même famille de cadrage, pas de zoom apparent.
