# Synchro Brevo : marquage des catégories contactées par listes

## Audit API Brevo (fait, spec officielle v3)

- Il n'existe **aucun tag sur les contacts** dans l'API Brevo. Les champs `tags` de la spec concernent les campagnes email/SMS ; les tags CRM ne s'appliquent qu'aux deals et sociétés.
- Le mécanisme natif équivalent est la **liste** : dans `POST /contacts` (avec `updateEnabled: true`), `listIds` est **additif** (il ajoute aux listes existantes, n'en retire aucune) et **idempotent** (rejouer une liste déjà attribuée ne crée pas de doublon et ne renvoie pas d'erreur).
- Décision validée : une liste Brevo par catégorie, nommée `contact_{categorie}`.

## Ce qui change dans le flux existant

Aucune nouvelle infrastructure. Seule l'Edge Function `brevo-sync-contact` évolue.

1. **Retrait des trois attributs prestataire** poussés sur le contact marié : `PRESTA_NOM`, `PRESTA_CAT`, `PRESTA_REGION`. Ils disparaissent de l'upsert contact et des `contact_properties` de l'event. Ils restent en revanche dans les `event_properties` de `contact_submitted` (donnée d'événement, pas de profil) — dis-moi si tu veux aussi les retirer de là.
2. **Pose du marqueur de catégorie** : résolution du libellé de la catégorie mère du prestataire, normalisation (minuscules, accents supprimés, séparateurs en underscore), préfixe `contact_` → `contact_traiteur`, `contact_photographe`.
3. La liste correspondante est **créée si elle n'existe pas**, puis son identifiant est passé dans `listIds` de l'upsert contact. Rien d'autre à faire : Brevo assure l'unicité.
4. L'attribut `CLIENT_CONTACT` n'est plus alimenté. Il n'a jamais été créé côté Brevo (le provisioning ne portait pas ce nom), donc rien à supprimer ; si tu en vois un dans l'interface, il peut être ignoré ou retiré à la main.

Inchangé : `PRENOM`, `NOM`, `TYPE_EVENEMENT`, `DATE_EVENT`, `DATE_CONTACT`, `CONSENTEMENT_MKT = false`, `A_UN_COMPTE`, event `contact_submitted`, trigger + `pg_net`, journal `brevo_sync_log`, cron de rattrapage.

## Nettoyage

Suppression du contact de test poussé lors de la mise en place (identifié depuis les logs de la fonction), via l'API Brevo, pour repartir propre.

## Détails techniques

- `supabase/functions/brevo-sync-contact/index.ts` :
  - suppression des trois attributs presta du bloc `attributes` ;
  - nouvelle fonction `slugTag(libelle)` (NFD + suppression des diacritiques, minuscules, `[^a-z0-9]+` → `_`, trim des `_`) ;
  - nouvelle fonction `ensureList(nom)` : `GET /contacts/lists?limit=50&offset=…` paginé pour retrouver la liste par nom, sinon `POST /contacts/lists` avec `{ name, folderId }` — le dossier cible est résolu/créé une fois via `GET /contacts/folders` (dossier `LesNoces` ou premier dossier existant) ;
  - `listIds: [id]` ajouté au corps du `POST /contacts` déjà en place ;
  - un échec de résolution de liste ne doit pas empêcher l'upsert du contact : la synchro se poursuit sans liste et le motif est journalisé (sans donnée personnelle).
- Un cache en mémoire (nom → id) évite de relister à chaque appel dans une même instance.
- Aucune migration, aucun changement de trigger, de journal ni de cron.

## Test réel de bout en bout

1. Soumission d'une demande sur une fiche de catégorie A → vérification : contact créé, liste `contact_{A}` présente, aucun attribut presta sur le contact.
2. Seconde demande, même email, même catégorie → le contact reste dans une seule occurrence de `contact_{A}` (pas de doublon, pas d'erreur).
3. Troisième demande, même email, catégorie B → le contact appartient désormais à `contact_{A}` **et** `contact_{B}`.
4. Nettoyage des demandes de test en base ; récap chiffré des attributs poussés et des listes obtenues.
