# Brevo — savoir qu'un prestataire migré a activé son compte

## Réponses à tes deux questions (vérifié dans le code et en base)

1. **L'origine est bien envoyée.** L'attribut `ORIGINE` est poussé sur chaque contact prestataire par `brevo-sync-prestataire` (valeurs : `inscription_admin`, `auto_inscription`, `migration`), et il est déclaré en liste fermée dans le provisioning de schéma. Tu peux donc segmenter sur `ORIGINE = migration` dès maintenant.

2. **La variable « a un compte » existe mais n'est pas alimentée pour les prestataires.** L'attribut `A_UN_COMPTE` (booléen) est déclaré dans le schéma Brevo, mais il n'est écrit que par la synchro des mariés (`brevo-sync-contact`, à partir de `profile_id`). La synchro prestataire ne l'envoie pas. Résultat : aujourd'hui, côté Brevo, rien ne distingue un prestataire migré qui a activé son compte d'un autre qui ne l'a jamais fait.

État actuel en base : les 3 230 fiches `origine = migration` ont toutes `user_id` vide (aucun compte lié). Le lien `user_id` se fait à l'acceptation de l'invitation — c'est exactement le signal « le prestataire a un email + un mot de passe ».

## Ce que je propose d'ajouter

### 1. `A_UN_COMPTE` sur les contacts prestataires
Poussé par `brevo-sync-prestataire` à chaque synchro : `true` dès que la fiche a un `user_id`, `false` sinon.

### 2. `DATE_ACTIVATION_COMPTE`
Nouvel attribut date, renseigné au moment où le compte est lié. Indispensable pour déclencher une chaîne relative (« J+1 après activation », « J+7 après activation ») plutôt qu'un envoi de masse à tout le segment.

### 3. Un événement `compte_active`
Émis une seule fois, au moment où la fiche passe de « sans compte » à « avec compte ». Propriétés : `origine`, `statut_fiche`, `region`. C'est le déclencheur naturel de ta chaîne côté Brevo pour les migrés, et il reste non rejouable (garde-fou existant dans `brevo_sync_log`).

### 4. Rattrapage de l'existant
Une passe unique de resynchronisation des fiches déjà liées à un compte (32 fiches aujourd'hui) pour poser `A_UN_COMPTE = true` sans émettre l'événement rétroactivement.

## Segmentation Brevo qui en découle

- Migrés jamais activés : `ORIGINE = migration` ET `A_UN_COMPTE = false` → chaîne de relance d'activation (celle déjà en place, M-01 à M-05).
- Migrés activés : `ORIGINE = migration` ET `A_UN_COMPTE = true` → nouvelle chaîne d'onboarding, déclenchée par l'événement `compte_active` ou relative à `DATE_ACTIVATION_COMPTE`.

## Détails techniques

- Migration SQL : ajout d'une colonne `compte_active_le` sur `prestataires`, renseignée par trigger quand `user_id` passe de NULL à une valeur ; extension de `brevo_prestataire_sync_trigger()` pour émettre le `kind` `compte_active` sur cette même transition.
- `supabase/functions/brevo-sync-prestataire/index.ts` : lecture de `user_id` et `compte_active_le`, ajout de `A_UN_COMPTE` et `DATE_ACTIVATION_COMPTE` dans `attributes`, prise en charge du nouveau `kind` d'événement avec ses propriétés.
- `supabase/functions/brevo-provision-schema/index.ts` : ajout de `DATE_ACTIVATION_COMPTE` (type `date`) ; `A_UN_COMPTE` est déjà déclaré. Relance du provisioning depuis l'onglet Connecteurs.
- Redéploiement des deux Edge Functions, puis passe de rattrapage sur les fiches ayant déjà un `user_id`.
