# Audit — Carte de France interactive au tableau de bord admin

## 1. Données de zones : fiables aujourd'hui

- `prestataires.zones_intervention` est un tableau de `zone_value` canoniques : code à 2-3 chiffres pour les départements (`01`, `75`), slug snake_case pour les régions (`ile_de_france`, `provence_alpes_cote_azur`).
- `zones_reference` (13 régions, 96 départements, 5 DOM, 4 pays) porte le lien enfant → parent via `parent_region_zone_value`, plus `dept_code` et `label` d'affichage.
- Le bug de zones (slugs de département sur les fiches migrées) est **corrigé** : sur 3 327 couples (fiche × zone), une seule valeur est hors référentiel, `france_entiere` (1 occurrence). Un trigger normalise désormais toute écriture.
- Conclusion : les agrégats départementaux et régionaux sont fiables. Seuls cas à traiter côté carte : `france_entiere` et les pays (`belgique`, etc.), à exclure ou à afficher comme total hors carte.
- Moyenne 1,02 zone par fiche ; 29 fiches sans aucune zone (à afficher comme « non localisées »).

## 2. Comptage : quel périmètre

- Répartition actuelle des statuts : `en_attente` 3 231, `actif` 32, `suspendu` 1. Les 3 230 fiches migrées sont encore en attente.
- Un filtre strict `statut = 'actif'` afficherait une carte quasi vide et sans intérêt pour piloter la migration.
- Recommandation : la carte compte par défaut les fiches **hors `archive` et `brouillon`** (périmètre « parc »), avec un sélecteur de statut (Tout le parc / Publiées uniquement) pour basculer sur `actif`.
- Multi-zones : un prestataire est compté **une fois dans chaque zone déclarée** (les totaux par zone ne s'additionnent donc pas au total de fiches — à indiquer dans la légende).
- Vue régionale : une fiche déclarant plusieurs départements d'une même région ne doit être comptée **qu'une fois** dans cette région → agrégation par `count(DISTINCT prestataire_id)` après remontée département → région parente.

## 3. Catégories

- Chaque fiche a `categorie_mere_id` obligatoire (0 sans catégorie) et `categorie_fille_id` optionnel (1 699 fiches renseignées).
- Le comptage se fait sur la catégorie mère ; la fille sert de filtre secondaire éventuel.
- `categories_familles` regroupe les 23 catégories mères en 6 familles ordonnées (Lieux & Hébergement, Réception & Gastronomie, Image/Musique/Animation, Style/Décor/Organisation, Transport & Matériel, Cérémonie/Papeterie/Services) → idéal pour un filtre à deux niveaux : famille, puis catégories de la famille.

## 4. Agrégation SQL

- Volumétrie minuscule : 3 327 couples fiche × zone. Aucun besoin de vue matérialisée ni de cache.
- Une fonction `security definer` `admin_stats_zones(p_statuts, p_categorie_ids)` renvoyant `(zone_value, type, label, parent_region_zone_value, categorie_mere_id, nb)` suffit : `unnest(zones_intervention)` + jointures `zones_reference` et `categories`, réservée aux admins via `has_role`.
- Alternative encore plus simple : un seul appel non filtré renvoyant le détail zone × catégorie (≈ 1 000 lignes), et tous les filtres appliqués côté client (instantanés, aucun aller-retour). C'est l'option retenue, avec mise en cache React Query.
- L'existant ne suffit pas : `brevo_compteurs_prestataires` ne fait pas d'agrégation géographique.

## 5. Rendu cartographique

- Pas de Leaflet ni Mapbox : inutile ici (pas de fond de carte, pas de tuiles, coût réseau).
- Solution retenue : **SVG choroplèthe statique** — un GeoJSON simplifié France (régions + départements, contours à faible résolution, ~80-150 Ko en un asset local) projeté avec `d3-geo` (+`topojson-client` si on part d'un TopoJSON), rendu en `<path>` React.
- Poids ajouté ≈ 40 Ko de JS (d3-geo/topojson) + le fond simplifié. Aucun réseau tiers, fonctionne hors ligne, se prête au thème (dégradé Or Riche sur fond Champagne).
- Mobile-first : SVG `viewBox` responsive, interaction au tap (sélection persistante d'une zone plutôt qu'un survol), panneau de détail sous la carte, bascule Régions/Départements (vue régions par défaut sur mobile, plus lisible), et repli tableau trié pour l'accessibilité.

## 6. Emplacement

- Nouveau composant `src/components/admin/CarteRepartitionPanel.tsx`, inséré dans `src/pages/admin/Dashboard.tsx` entre le bloc d'alertes et la grille deux colonnes (« Dernières demandes » / « Avis en attente »).
- Aucun impact sur les espaces public, client ou prestataire : lecture seule, route admin existante, accès déjà protégé par le layout `/admin`.

## Ce que l'implémentation comprendrait

1. Migration SQL : fonction d'agrégation admin (zone × catégorie mère × statut) avec contrôle `has_role`.
2. Asset TopoJSON France simplifié (régions + départements) versionné dans `src/assets/`.
3. Composant carte SVG + filtres famille/catégorie + bascule Régions/Départements + sélecteur de périmètre statut.
4. Panneau latéral/inférieur avec le classement des zones et le détail par catégorie de la zone sélectionnée.
