## Objectif
Rendre la pagination fonctionnelle sur `/blog` — cliquer sur un numéro ou « Suivante » doit réellement changer les articles affichés dans la grille « Récits & réflexions ».

## Changement (fichier : `src/pages/Blog.tsx`)

1. **Brancher `page` sur le slice** :
   `tail = filtered.slice(3 + (page - 1) * PAGE_SIZE, 3 + page * PAGE_SIZE)`
   (au lieu de l'offset codé en dur à `3`).

2. **Remonter automatiquement** vers la section « Récits & réflexions » quand `page` change, pour éviter que l'utilisateur reste en bas et ne voie pas que le contenu a changé. Ajout d'une `ref` sur le titre de section + `useEffect([page])` avec `scrollIntoView({ behavior: "smooth", block: "start" })`. Skip au premier render.

3. **Reset `page = 1`** quand le nombre total d'articles filtrés devient inférieur à l'offset courant (déjà fait au changement de catégorie ; à sécuriser aussi si `filtered.length` diminue pour une autre raison — via un `useEffect` qui remet `page` à 1 si `page > totalPages`).

4. **Masquer la pagination** quand `totalPages <= 1` (déjà le cas via la condition `totalPages > 1`, on garde).

## Vérification
- Avec > 12 articles publiés : cliquer sur 2 doit afficher les articles 12-20, sur 3 les articles 21-29, etc.
- Le bouton « Suivante » ne doit plus apparaître sur la dernière page (déjà géré par `page < totalPages`).
- Le scroll doit revenir vers le titre « Récits & réflexions » au changement de page.
- Aucun impact sur l'article vedette ni les deux tuiles secondaires (positions 0-2), qui restent fixes.
