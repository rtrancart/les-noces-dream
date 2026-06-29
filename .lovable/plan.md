## Objectif

Introduire une notion de **familles éditoriales** pour regrouper les catégories mères, une administration dédiée, puis refondre le **Header** (mobile-first, desktop méga-menu) pour exploiter ces familles, avec les pictos fournis. Direction visuelle conservée : barre dorée, logo blanc existant, typographie fine.

---

## 1. Données — table `categories_familles`

Nouvelle table publique :
- `id` (uuid, pk)
- `cle` (text, unique, stable — ex. `lieux-hebergement`)
- `libelle` (text — affiché)
- `ordre_affichage` (int)
- timestamps

Ajout d'une colonne `famille_id uuid` sur `categories` (FK → `categories_familles.id`, `ON DELETE SET NULL`). Renseignée uniquement sur les **catégories mères** (sous-catégories ignorent le champ et héritent à l'affichage).

RLS :
- lecture publique (`anon`, `authenticated`) — utilisée par le header.
- écriture réservée à `admin` / `super_admin` via `has_role()`.

GRANT explicites (SELECT anon/authenticated, ALL service_role, écritures authenticated filtrées par policy).

Seed des 6 familles dans l'ordre demandé puis rattachement des catégories mères existantes :

| Famille | Catégories mères rattachées |
|---|---|
| Lieux & Hébergement | Lieux de réception, Hébergements |
| Réception & Gastronomie | Traiteur & Gastronomie, Barmen, Caviste / Domaine viticole |
| Image, Musique & Animation | Photographe / Vidéaste, Musicien & DJ, Animation, Artificier |
| Style, Décor & Organisation | Wedding planner, Décoration, Fleuriste, Vêtements mariage, Bijoux de mariage, Beauté |
| Transport & Matériel | Transport & Véhicules, Location de matériel |
| Cérémonie, Papeterie & Services | Officiant de cérémonie, Faire-parts, Agents de sécurité, Service de ménage, Nounous et Animatrice enfants |

## 2. Pictos — remplacement intégral

Upload des 22 SVG fournis dans le bucket `categories-assets` sous `<slug>/picto.svg`, puis UPDATE de `categories.icone_url` pour **toutes les 22 catégories mères** concernées (les anciens PNG/pictos existants sont écrasés/remplacés par les nouveaux SVG, conformément à la table de correspondance du fichier `apercu.html`).

## 3. Administration — page `/admin/categories`

- Le tableau actuel (mères + sous-catégories drag-and-drop) est conservé tel quel.
- Dans le **dialog d'édition** d'une catégorie : ajouter un `<select>` « Famille » alimenté depuis `categories_familles` ordonnées par `ordre_affichage`. Visible uniquement quand `parent_id` est vide (catégorie mère). Option « Aucune (→ Autres) ».
- Nouvel **onglet « Familles »** sur la même page (tabs « Catégories | Familles ») :
  - Liste drag-and-drop des familles (libellé + nb de catégories rattachées).
  - Bouton « Nouvelle famille », édition inline du libellé, suppression avec confirmation (les catégories passent à `famille_id = NULL`).
  - L'ordre persiste dans `ordre_affichage` et pilote le header.

## 4. Header — refonte complète (`src/components/layout/Header.tsx`)

Fond dégradé doré `linear-gradient(180deg, #BEA174, #AE9266)`, sticky, hauteur 80 px desktop / 64 px mobile, logo blanc existant à gauche.

### Barre principale (desktop)
Centre : **Prestataires** (chevron, méga-menu), **Mariage par région** (chevron, méga-menu), **Inspirations & Conseils** (lien direct vers `/blog`).
Droite, dans l'ordre : loupe (toggle barre de recherche), historique avec badge (composant existant `HeaderHistoriqueButton`), « Mon compte », bouton outlined arrondi « Vous êtes prestataire ? » → `/inscription`.

### Barre de recherche déployable
Cachée par défaut. Clic loupe → panneau qui glisse sous le header avec champ mot-clé, champ localisation (réutilise `LocationPicker`) et bouton « Rechercher » → navigue vers `/prestataires?...`.

### Méga-menu Prestataires (desktop)
Chargé dynamiquement (React Query) :
1. `categories_familles` triées par `ordre_affichage`
2. `categories` mères (avec sous-catégories) groupées par `famille_id`, mères sans famille → groupe « Autres » en dernier.

Layout : grille 3 colonnes sur fond ivoire. Pour chaque famille : titre doré uppercase + ligne fine ; sous chaque famille, liste de mères avec **médaillon rond ivoire 42 px à bordure dorée** contenant le picto (22 px), libellé cliquable → `/categories/<slug>`, sous-catégories en sous-liste discrète → `/categories/<slug-sous-cat>`. Médaillon neutre si `icone_url` absent. Lien final « Voir toutes les catégories » → `/prestataires`.

### Méga-menu Régions (desktop)
Liste les régions depuis `pages_regions_mariage` (actives), grille simple, chaque région → page éditoriale existante.

### Menu mobile (drill-down)
Drawer plein écran, panneaux qui glissent (framer-motion translateX), pas d'accordéon.
- Panneau 1 : barre de recherche persistante en haut + entrées principales (Prestataires →, Mariage par région →, Inspirations & Conseils, Mon compte, Vous êtes prestataire ?).
- Panneau 2 (Prestataires) : flèche retour + titres de famille + mères avec médaillon picto. Tap mère sans enfants → navigue ; mère avec enfants → panneau 3.
- Panneau 3 : sous-catégories de la mère + flèche retour.
- Panneau Régions équivalent.
- Cibles tactiles ≥ 48 px, espacements généreux.

## 5. Routes

Aucune nouvelle route. Réutilise les existantes : `/prestataires`, `/categories/<slug>`, `/mariage/<region-slug>`, `/inscription`, `/blog`.

## 6. Détails techniques

- Hook `useHeaderCategories()` (React Query, stale 10 min) renvoyant `familles[]` + map `famille_id → mères[] → enfants[]` + groupe « Autres ». Utilisé par desktop ET mobile.
- Tokens couleur dans `index.css` : `--header-or-from`, `--header-or-to`, `--header-ivoire`, `--header-or-fonce` (HSL). Pas de hex en dur.
- Régénération `types.ts` automatique après migration.
- Composants : `Header.tsx`, `HeaderMegaMenuPrestataires.tsx`, `HeaderMegaMenuRegions.tsx`, `HeaderSearchPanel.tsx`, `HeaderMobileMenu.tsx`, `CategoryMedallion.tsx`.

## 7. Ordre d'exécution

1. Migration SQL (table familles + colonne `famille_id` + RLS + GRANT + seed des 6 familles + rattachement des mères).
2. Upload des 22 nouveaux pictos SVG dans Storage (écrasement des anciens) + UPDATE `icone_url` pour les 22 mères.
3. Admin : tabs Catégories/Familles + select famille dans le dialog.
4. Hook `useHeaderCategories`.
5. Refonte Header (mobile d'abord, puis desktop, puis méga-menus).
6. Tokens CSS + nettoyage anciens liens header.

## Hors scope
- Pages de listing catégories/sous-catégories (routes inchangées).
- Pages régionales (lecture seule).
- Footer.
- Aucune logique métier modifiée côté espace prestataire ou client.
