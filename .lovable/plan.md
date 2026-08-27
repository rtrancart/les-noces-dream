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

- `/recherche` (`src/pages/Recherche.tsx`, `matchesZones`) : compare les valeurs sélectionnées (codes dépt / régions snake, issues de `src/lib/zonesIntervention.ts`) au tableau `zones_intervention`, plus un repli sur le libellé `region` de la fiche.
- Pages listing `/{categorie}/{zone}` (`src/pages/PrestatairesListe.tsx` + `src/lib/zoneResolver.ts`) : la zone d'URL est résolue via `zones_reference` puis comparée à `zone_value`, avec repli région et rayon Haversine pour les villes.

Deux angles morts confirmés dans `matchesZones` :

1. sélectionner une **région** ne fait pas remonter une fiche qui ne liste que des **départements** de cette région ;
2. le repli région s'appuie sur une table de libellés locale (`zonesIntervention.ts`) au lieu du référentiel base.

## Ce que je vais faire

1. **Migration de normalisation des données** : réécrire `zones_intervention` de toutes les fiches vers les `zone_value` du référentiel — slug de département → code, variantes orthographiques (`cotes-darmor` → `22`, `val-doise` → `95`, `provence_alpes_cote_dazur` → `provence_alpes_cote_azur`) → valeur canonique, dédoublonnage, conservation de `france_entiere`. Rapport avant/après et vérification qu'il ne reste zéro valeur hors référentiel.
2. **Garde-fou en base** : trigger sur `prestataires` qui normalise à l'écriture toute valeur de `zones_intervention` (slug, code, libellé accentué) vers la `zone_value` canonique et rejette une valeur inconnue — même principe que le trigger déjà en place sur `region`.
3. **Correctif du filtre** : dans `matchesZones`, faire remonter une fiche quand la zone sélectionnée est une région et que la fiche couvre un département de cette région (et inversement département sélectionné / région couverte, déjà géré côté listing). Aucun changement visuel.
4. **Vérification** : contrôles SQL de couverture par région/département avant/après, et test du parcours de recherche sur une zone où seules des fiches migrées interviennent.

## Détails techniques

- Table de correspondance construite dynamiquement depuis `zones_reference` (`slug` → `zone_value`), avec normalisation sans accents et suppression des apostrophes pour rattraper `cotes-darmor` / `val-doise`.
- La normalisation d'écriture réutilise `normaliser_cle_zone` / la logique du trigger `normaliser_region_prestataire`.
- Côté front, l'expansion région ↔ départements s'appuie sur `zones_reference` (déjà préchargé dans `ZonesContext`), pas sur la liste statique.
