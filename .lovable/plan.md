# Deux ajustements dans l'administration

## Réponse à votre question sur la carte

Non, la carte ne compte pas seulement les prestataires actifs. Aujourd'hui elle prend **tous les statuts sauf « archivé » et « brouillon »** (donc en attente, à corriger, pré-inscrit, à compléter, validée, suspendu, actif, résilié). Le bouton « Publiés » filtre ensuite sur les seuls actifs, tandis que « Parc » affiche cet ensemble.

## 1. Recherche de ville dans la fenêtre de création d'un prestataire

Le champ « Ville » de l'onglet Coordonnées est aujourd'hui une simple zone de texte libre : fautes de frappe, doublons et villes inexistantes possibles.

Il devient un champ de recherche avec suggestions, sur le même service officiel des adresses françaises déjà utilisé ailleurs dans le site (recherche limitée aux communes) :
- on tape les premières lettres, une liste de communes s'affiche avec le code postal et le département ;
- en sélectionnant une commune, la ville, le code postal et la région se remplissent automatiquement, ainsi que les coordonnées géographiques (utile pour la carte de recherche) ;
- la saisie libre reste possible si aucune suggestion ne convient.

Le même champ est utilisé en création et en modification, pour rester cohérent.

Remarque : Google Maps est disponible sur le projet, mais pour des communes françaises le service officiel des adresses est plus précis, gratuit et déjà en place ; je pars donc là-dessus, sauf demande contraire.

## 2. Ajouter les brouillons à la carte de France

- Les fiches en brouillon entrent dans le calcul de la carte (elles en sont exclues aujourd'hui).
- Les fiches archivées restent exclues.
- Le périmètre « Publiés » continue de n'afficher que les fiches actives : les brouillons n'apparaissent donc que dans le périmètre « Parc ».
- La légende du périmètre « Parc » est précisée pour indiquer ce qu'il englobe (tous les statuts sauf archivés).

## Détails techniques

- `src/pages/admin/Prestataires.tsx` : remplacement de l'`Input` ville par un nouveau composant `CityAutocomplete` (dérivé de `AddressAutocomplete`, appel `api-adresse.data.gouv.fr` avec `type=municipality`), qui remonte ville, code postal, région (via `zones_reference` / `REGIONS_FR`), latitude et longitude vers `form`.
- Migration : `admin_stats_zones_categories()` — la clause `statut NOT IN ('archive','brouillon')` devient `statut <> 'archive'`. Aucune autre logique modifiée ; `admin_stats_zones_categories_json()` en hérite automatiquement.
- `CarteRepartitionPanel.tsx` : aucun changement de logique, seulement le libellé d'aide du périmètre.
