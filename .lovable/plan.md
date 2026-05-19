## Problème

Sur la fiche admin d'un prestataire `actif`, le champ Statut affiche un badge en lecture seule avec le message « Non modifiable manuellement ». Conséquence : impossible de suspendre ou archiver un actif (cas typique : abonnement résilié, manquement à la charte, demande de retrait).

Au niveau DB, ce n'est pas bloqué : le trigger `prevent_direct_actif_write` interdit uniquement d'**écrire** le statut `actif` directement. Sortir de `actif` vers `suspendu`, `archive`, `a_corriger`, etc. est autorisé. C'est purement une restriction UI à lever.

## Décision

Garder l'invariant « on n'écrit jamais `actif` à la main » mais permettre toutes les **sorties** depuis `actif`. Le `<Select>` reste affiché pour les fiches actives, avec `actif` exclu des options choisissables (cohérent avec `SELECTABLE_STATUTS` actuel).

## Changements — `src/pages/admin/Prestataires.tsx`

1. Supprimer la branche `form.statut === "actif" ? <Badge…/> : <Select…/>` aux lignes 982–996. Toujours rendre le `<Select>`.
2. Dans le `<Select>`, quand le statut courant est `actif` :
   - Pré-sélectionner `actif` (affiché en valeur courante via un `SelectItem` désactivé `value="actif"` placé en tête, pour que `<SelectValue>` ait un libellé).
   - Les autres options proviennent toujours de `SELECTABLE_STATUTS` (suspendu, archive, a_corriger, en_attente, validee, a_completer, brouillon, pre_inscrit).
3. Ajouter sous le `<Select>` un court texte d'aide quand `form.statut === "actif"` : « Sélectionnez un nouveau statut pour suspendre, archiver ou repasser la fiche en correction. Le statut actif est attribué automatiquement (validée + charte signée). »
4. Avant `handleSave`, si l'ancien statut est `actif` et que le nouveau est `suspendu`, garantir que `motif_suspension` est renseigné (déjà géré par le formulaire ? sinon ajouter un `Select` motif visible uniquement dans ce cas). À confirmer en lisant la section motif existante avant implémentation.

## Hors scope

- Aucun changement DB, trigger, ni Edge Function.
- Aucun changement sur la signature charte ou les transitions automatiques.
- Pas de modification de la logique presta (`Profil.tsx`, bannières).

## Vérification

- Ouvrir une fiche `actif` dans `/admin/prestataires` → le `<Select>` est visible, valeur courante « Actif ».
- Choisir « Suspendu » → save OK, badge passe à Suspendu, log `statut_transition` créé.
- Choisir « Archivé » → idem.
- Tenter via DevTools de POSTer `statut = 'actif'` directement → toujours bloqué par le trigger DB (invariant préservé).
