# Colonne de vérification d'email + filtre admin Prestataires

## Objectif
Pouvoir qualifier chaque adresse email de contact des prestataires via un outil externe de vérification, puis filtrer les fiches dans l'admin pour n'envoyer des emails qu'aux adresses validées. Au départ, toutes les fiches ont le champ vide (jamais vérifiées).

## Ce qui change

### 1. Base de données (migration)
- Nouveau type énuméré `verification_email` avec les 4 valeurs :
  - `valid` — adresse existante et délivrable
  - `unknown` — vérification non concluante (boîte grise, timeout)
  - `invalid` — adresse inexistante / rejetée
  - `accept_all_unverifiable` — domaine qui accepte tout, impossible de confirmer
- Nouvelle colonne `email_verifie verification_email` sur `prestataires`, **sans valeur par défaut** : toutes les lignes existantes restent NULL (« pas encore vérifié »), conformément à la demande.
- Aucune donnée modifiée : aucune ligne n'est pré-remplie.

### 2. Page admin /admin Prestataires (src/pages/admin/Prestataires.tsx)
- Nouveau filtre « Email vérifié » sous forme de liste déroulante, à côté des filtres existants (statut, catégorie, email rejeté) :
  - **Tous** (défaut)
  - **Valid**
  - **Unknown**
  - **Invalid**
  - **Accept-all (non vérifiable)**
  - **Non vérifié** (champ vide — permet de suivre la progression du travail de vérification)
- Le filtre s'applique côté requête : `email_verifie = <valeur>` ou `email_verifie IS NULL` pour « Non vérifié ».
- Il se cumule avec les filtres existants (statut, catégorie, recherche nom/email, email rejeté, zone, ville) comme aujourd'hui.
- La sélection en cours est réinitialisée quand ce filtre change (comportement identique aux autres filtres).

La valeur ne s'affiche pas encore dans le tableau ni dans la fiche d'édition — c'est un filtre uniquement, comme demandé. On pourra ajouter un badge dans le tableau si besoin plus tard.

### 3. Type généré
- Le fichier de types est régénéré automatiquement après la migration ; la page utilise la nouvelle colonne typée.

## Notes techniques
- `ALTER TABLE ... ADD COLUMN` sur une table existante : pas de `GRANT` supplémentaire nécessaire (la table a déjà ses droits et ses policies RLS admin).
- Type énuméré plutôt que texte libre : cohérent avec les autres statuts du schéma (statut_demande, statut_avis…) et protège contre les fautes de saisie. Si l'outil externe produit un jour une 5e valeur, il faudra une petite migration `ALTER TYPE ... ADD VALUE`.
- Le filtre s'applique aussi aux comptages et à la sélection groupée existants, puisqu'ils partagent le même état de filtres.

## Vérification
- La colonne apparaît dans le schéma avec toutes les valeurs NULL.
- Dans l'admin, choisir « Non vérifié » : toutes les fiches actuelles sont listées.
- Marquer manuellement une fiche `valid` en base : elle disparaît du filtre « Non vérifié » et apparaît sous « Valid ».
- Vérifier que le filtre se cumule avec « Statut » et « Email rejeté » sans erreur.
