# Recherche par email dans l’admin Prestataires

## Objectif
Dans l’onglet **Prestataires** de l’admin, le champ de recherche actuel filtre sur le nom commercial (`nom_commercial_norm`). Il doit aussi pouvoir filtrer sur l’**email de contact** de la fiche (`prestataires.email_contact`), affiché dans le tableau.

## Ce qui change

- `src/pages/admin/Prestataires.tsx` :
  - La requête de recherche passe d’un simple `ilike("nom_commercial_norm", ...)` à un `or()` combinant :
    - `nom_commercial_norm.ilike.%terme%`
    - `email_contact.ilike.%terme%`
  - Le terme est normalisé de la même manière (désaccentuation + minuscules) pour les deux colonnes.
  - Le placeholder du champ est mis à jour pour indiquer que la recherche porte aussi sur l’email, par exemple : *« Rechercher un prestataire ou un email… »*.

- Aucune modification de base de données n’est requise.

## Performance

- Aujourd’hui la table compte environ **3 269 prestataires**, dont **3 266 ont un email_contact** : le volume reste modeste.
- La requête actuelle utilise déjà un `ilike` avec joker en début (`%terme%`), ce qui ne profite pas de l’index existant sur `nom_commercial_norm`. Ajouter un second `ilike` sur `email_contact` revient à scanner la même petite table sur deux colonnes au lieu d’une : l’impact sera imperceptible à ce volume.
- Un index unique existe déjà sur `lower(email_contact)` (`prestataires_email_contact_lower_unique`), mais il n’accélérera pas une recherche de sous-chaîne. Si un jour le volume rendait la recherche lente, la solution serait d’ajouter un index GIN trigramme (`pg_trgm`) sur `email_contact` et/ou `nom_commercial_norm`.

## Vérification

- Saisir un fragment d’email dans le champ de recherche : la liste doit se filtrer et afficher les fiches correspondantes.
- Saisir un nom commercial : le comportement actuel doit être conservé.
- Vérifier que les filtres par statut, catégorie, zone géographique et email rejeté continuent de fonctionner conjointement à la recherche.
