# Normaliser les zones d'intervention pour la recherche

## Audit — ce que contient la base aujourd'hui

Le référentiel `zones_reference` définit la valeur canonique attendue (`zone_value`) :

- région → forme snake_case : `ile_de_france`, `provence_alpes_cote_azur`…
- département → code à 2/3 chiffres : `01`, `75`, `971`…
- pays → `belgique`, `suisse`, `monaco`, `luxembourg`
- plus le mot-clé spécial `france_entiere`

Ce que contient réellement `prestataires.zones_intervention` :

| Forme | Occurrences | Origine |
|---|---|---|
| `zone_value` correcte (codes dépt, régions snake) | 100 | fiches admin |
| **Slug de département** (`ain`, `gironde`, `alpes-maritimes`…) | 3 113 | migration |
| Variantes hors référentiel : `cotes-darmor`, `val-doise`, `provence_alpes_cote_dazur` | 113 | migration + admin |
| `france_entiere` | 2 | légitime |

Conclusion : l'import de migration a écrit des **slugs de département** là où la recherche attend des **codes**. Les ~3 100 fiches migrées ne remontent donc jamais sur un filtre de zone (elles ne remontent que via leur champ `region`, désormais normalisé).

## Audit — comment fonctionne le filtre de recherche

Deux chemins, tous deux comparant à `zone_value` :

- `/recherche` (`src/pages/Recherche.tsx`, `matchesZones`) : compare les valeurs sélectionnées (codes dépt / régions snake) au tableau `zones_intervention`, plus un repli sur le libellé `region` de la fiche.
- Pages listing `/{categorie}/{zone}` (`src/pages/PrestatairesListe.tsx` + `src/lib/zoneResolver.ts`) : la zone d'URL est résolue via `zones_reference` puis comparée à `zone_value`, avec repli région et rayon Haversine pour les villes.

Angle mort confirmé dans `matchesZones` : sélectionner une **région** ne fait pas remonter une fiche qui ne liste que des **départements** de cette région.

## Pass audit-only du mapping (déjà exécuté)

Table de correspondance construite depuis `zones_reference` sur une clé normalisée (minuscules, sans accents, sans tirets/apostrophes/underscores), alimentée par `slug` **+** `label` **+** `zone_value` — donc régions, départements, DOM et pays au même titre. Résultat sur les données réelles :

- **0 valeur orpheline** après application (hors `france_entiere`, conservé tel quel) — `cotes-darmor`, `val-doise` et `provence_alpes_cote_dazur` sont bien rattrapés, la variante région incluse.
- **0 collision** : aucune clé normalisée ne pointe vers deux `zone_value` différentes.

## Ce que je vais faire

1. **Filet de sécurité + migration des données**
   - Sauvegarde préalable dans une table `zones_intervention_backup` (`prestataire_id`, `zones_avant`, `zones_apres`, date) permettant un rollback intégral.
   - Réécriture **en remplacement valeur par valeur, sans ajout ni retrait** : `gironde` → `33`, et si la région parente figurait déjà dans le tableau elle est conservée telle quelle (aucune expansion, aucune suppression de région parente). La sémantique de couverture déclarée par le prestataire est strictement préservée.
   - Dédoublonnage **après** mapping, ordre stable, `france_entiere` conservé.
   - Contrôle post-migration : zéro valeur hors référentiel, et comparaison du nombre de fiches couvertes par zone avant/après.

2. **Garde-fou en base — tolérant, pas bloquant**
   - Trigger `BEFORE INSERT/UPDATE` qui normalise chaque entrée via la même clé (donc **idempotent** : `33` → `33`, `ile_de_france` → `ile_de_france`, une valeur déjà canonique n'est jamais cassée).
   - Une valeur inconnue n'annule **pas** la transaction : elle est écartée du tableau et journalisée (`logs_admin`, action `zone_intervention_inconnue`), les valeurs valides sont écrites. Pas de `RAISE EXCEPTION`.
   - Tableau vide ou `NULL` reste accepté.

3. **Correctif du filtre `matchesZones`**
   - Une fiche remonte sur une région sélectionnée si elle couvre cette région **ou** au moins un de ses départements. L'expansion est strictement bornée à la relation région → ses départements enfants via `parent_region_zone_value` de `zones_reference` : un `belgique`, un `monaco` ou un DOM n'est jamais aspiré par l'expansion d'une région métropolitaine.
   - `france_entiere` conserve son comportement actuel (match universel), inchangé.
   - Performance : l'index région → départements est construit **une seule fois** (mémoïsé depuis `ZonesContext`), pas par fiche ni par frappe ; le filtrage reste une intersection de `Set`. Vérification du rendu sur viewport mobile.

4. **Vérification**
   - Contrôles SQL de couverture par région et par département, avant/après.
   - Parcours de recherche testé sur une zone servie uniquement par des fiches migrées, en desktop et en mobile.

## Détails techniques

- Clé de normalisation partagée entre la migration et le trigger (fonction SQL unique), basée sur `immutable_unaccent` + suppression des séparateurs.
- La table de correspondance est dérivée dynamiquement de `zones_reference` (slug, label et zone_value), donc elle suit automatiquement toute évolution du référentiel.
- Côté front, l'expansion s'appuie sur `zones_reference` déjà préchargé par `ZonesContext`, pas sur la liste statique `zonesIntervention.ts`.
