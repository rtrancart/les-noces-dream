# Recherche de ville dans la fiche prestataire (admin)

## Réponse à votre question sur la carte

Non, la carte ne compte pas seulement les prestataires actifs : elle prend tous les statuts sauf « archivé » et « brouillon ». Le bouton « Publiés » filtre ensuite sur les seuls actifs. Comme demandé, la carte n'est pas modifiée.

## Ce qui change

Le champ « Ville » de l'onglet Coordonnées, dans la fenêtre de création et de modification d'un prestataire, est aujourd'hui une simple zone de texte libre : fautes de frappe, doublons et villes inexistantes possibles.

Il devient un champ de recherche avec suggestions, sur le service officiel des adresses françaises déjà utilisé ailleurs dans le site (recherche limitée aux communes) :
- on tape les premières lettres, une liste de communes s'affiche avec le code postal et le département ;
- en sélectionnant une commune, la ville, le code postal et la région se remplissent automatiquement, ainsi que les coordonnées géographiques utilisées par la carte de recherche ;
- la saisie libre reste possible si aucune suggestion ne convient ;
- la région déjà choisie n'est écrasée que si la commune sélectionnée en indique une.

Le même champ sert en création et en modification, pour rester cohérent.

Remarque : Google Maps est disponible sur le projet, mais pour des communes françaises le service officiel des adresses est plus précis, gratuit et déjà en place ; je pars donc là-dessus, sauf demande contraire.

## Détails techniques

- Nouveau composant `src/components/admin/CityAutocomplete.tsx`, dérivé de `AddressAutocomplete` (appel `api-adresse.data.gouv.fr/search/?type=municipality`, saisie débattue, fermeture au clic extérieur).
- `src/pages/admin/Prestataires.tsx` : remplacement de l'`Input` du champ Ville par ce composant ; mise à jour de `form.ville`, `code_postal`, `region`, `latitude`, `longitude`.
- Aucune modification de base de données, aucune modification de la carte de répartition.
