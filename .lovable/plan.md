## Objectif

Corriger le méga-menu "Prestataires" du header desktop qui dépasse la ligne de flottaison : les catégories du bas ne sont pas visibles.

## Solution retenue — Option C (compactage + filet de sécurité)

1. **Passer à 4 colonnes** sur les écrans `xl:` pour répartir le contenu plus horizontalement.
2. **Réduire les espacements** : `gap-y-8` → `gap-y-6`, `space-y-2.5` → `space-y-1.5`, `mb-4` → `mb-2`, padding vertical `py-8` → `py-6`, marge/padding du footer `mt-8 pt-5` → `mt-6 pt-4`, etc.
3. **Ajouter une hauteur max et un scroll interne** au conteneur principal : `max-h-[calc(100vh-6rem-1rem)] overflow-y-auto`.
   - La hauteur max tient compte du header (≈5–6 rem) + une marge de sécurité.
   - Si le contenu reste trop haut malgré la compaction, l'utilisateur peut scroller à l'intérieur du panneau.

## Fichier à modifier

- `src/components/layout/HeaderMegaMenuPrestataires.tsx` uniquement.

## Non-impacts

- Aucune donnée, catégorie, API, route, ou autre composant touché.
- Aucun changement de design system ni de tokens globaux.

Clique sur "Implement plan" pour passer en build mode et appliquer la modification.