# Retirer les prestataires migrés de l'email « Votre fiche est publiée »

Les prestataires issus de la migration ne doivent recevoir que les emails de la
chaîne M (M-01 et relances). Aujourd'hui, quand leur fiche passe en ligne, un
second email « Votre fiche est publiée sur LesNoces.net » part en plus.

## Ce qui change

1. **Validation groupée des fiches migrées** : l'email de publication n'est plus
   envoyé du tout. Ces fiches sont par définition migrées, et le M-01 annonce
   déjà la mise en ligne avec le lien.
2. **Changement de statut individuel depuis l'admin** : l'email de publication
   n'est envoyé que si la fiche n'est pas d'origine migration. Pour une
   inscription normale, le comportement reste identique (email envoyé + message
   de confirmation).

Aucune autre chaîne d'emails, aucun statut et aucune donnée ne sont touchés.

## Détails techniques

- `src/lib/admin/bulkValidateInvite.ts` : suppression du bloc qui invoque
  `send-transactional-email` avec `validation_publication_fiche` après la RPC
  `valider_prestataire_migre` (la validation, le log admin et l'invitation
  restent inchangés).
- `src/pages/admin/Prestataires.tsx` (`updateStatut`) : ajout de `origine` au
  `.select(...)` de l'update, et envoi de l'email conditionné à
  `updated.origine !== "migration"`.
- Le template `validation-publication-fiche.tsx` et son entrée de registre sont
  conservés tels quels.

## Vérification

- `bunx tsc --noEmit`
- Tests existants de `bulkValidateInvite` s'ils couvrent le flux.
