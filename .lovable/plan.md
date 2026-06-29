## Objectif

Remplacer la recherche actuelle du header (deux champs texte libres `keyword` + `lieu`) par les mêmes sélecteurs structurés que la home — `CategoryPicker` (catégorie/sous-catégorie) + `LocationPicker` (zones d'intervention OU ville+rayon) — via un composant partagé.

## Approche

Créer un composant partagé `SearchBar` réutilisé par la home et le header, pour garantir un comportement strictement identique (mêmes paramètres d'URL générés : `categorie`, `lieu`, `ville`).

### 1. Nouveau composant `src/components/search/SearchBar.tsx`

Encapsule la logique aujourd'hui dans `HeroSection` (Index.tsx lignes 188-203 + JSX 227-255) :
- États internes : `categorySlugs`, `locationZones`, `citySearch`.
- Fetch du `categoryTree` en interne (mutualisé via un hook `useCategoryTree` extrait de `useHomeData`) — la home n'a plus à le passer en prop.
- `handleSearch` → navigue vers `/recherche?...` avec exactement la même construction d'URL qu'aujourd'hui.
- Props : `variant: "hero" | "header-desktop" | "header-mobile"` + `onSubmit?: () => void` (pour fermer le panel du header après recherche).

Le variant pilote uniquement le style/layout (carte blanche arrondie pour `hero`, panneau ivoire pleine largeur pour `header-desktop`, colonne compacte pour `header-mobile`) — la logique est strictement la même.

### 2. Refonte de `HeaderSearchPanel.tsx`

Supprimer les deux `<Input>` texte et le `useState` keyword/lieu. Le panneau devient une coquille (wrapper ivoire + bouton close X) qui rend `<SearchBar variant="header-desktop" onSubmit={onClose} />` ou `variant="header-mobile"`.

### 3. Simplification de `HeroSection` (Index.tsx)

Remplacer les états `locationZones/categorySlugs/citySearch`, `handleSearch`, et le bloc JSX 227-255 par `<SearchBar variant="hero" />`. La prop `categoryTree` passée à `HeroSection` devient inutile (le composant le fetch lui-même).

### 4. Hook partagé `src/hooks/useCategoryTree.ts`

Extrait du `fetch` de catégories actuellement dans `useHomeData` (Index.tsx) — renvoie `CategoryOption[]` pour `CategoryPicker`. Mis en cache via React Query pour éviter un refetch sur chaque ouverture du panel header.

## Détails techniques

- Aucun changement de schéma DB, aucune nouvelle route.
- Le `LocationPicker` gère déjà l'option « France entière » (zone) et la recherche ville+rayon ; on conserve ce comportement tel quel.
- Le bouton « Rechercher » du header ferme le panneau (`onSubmit` callback) puis navigue.
- Compatibilité URL : on génère exactement les mêmes params qu'aujourd'hui sur la home (`categorie`, `lieu`, `ville`), ce que `Recherche.tsx` sait déjà lire et resynchroniser.

## Fichiers impactés

- ➕ `src/components/search/SearchBar.tsx` (nouveau)
- ➕ `src/hooks/useCategoryTree.ts` (nouveau)
- ✏️ `src/components/layout/HeaderSearchPanel.tsx` (simplifié)
- ✏️ `src/pages/Index.tsx` (HeroSection simplifié, fetch catégories délégué)

## Hors scope

- Pas de changement de la page `/recherche` elle-même.
- Pas de changement des méga-menus catégories/régions du header.
