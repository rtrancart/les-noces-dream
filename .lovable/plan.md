## Objectif

Permettre au Tunnel « campagne d'invitation des prestataires migrés » d'émettre des liens d'invitation valides **60 jours**, tout en laissant le Tunnel A admin classique continuer d'émettre des liens à **7 jours** (comportement actuel inchangé), et sans jamais modifier le TTL par défaut du helper.

## Principe

Le TTL doit être décidé **au site d'appel**, pas dans le helper. `signInvitationToken` accepte déjà `ttlSeconds` en paramètre optionnel avec un défaut de 7 jours — ce défaut reste tel quel et fait autorité pour tout appel qui ne précise rien. La campagne migration passera explicitement 60 jours.

## Comment on distingue le contexte

Le signal métier existe déjà : la colonne `prestataires.origine` (dont la valeur `migration` est utilisée pour les fiches importées de l'ancien site) est **immuable après création** (trigger `prevent_origine_prestataire_modification`). C'est le signal le plus fiable et il est déjà source de vérité.

Approche retenue : un **paramètre explicite** `long_ttl` (ou équivalent) accepté par `invite-prestataire` et `resend-magic-link`, avec un garde-fou serveur qui n'autorise ce mode long que si la fiche a bien `origine = 'migration'`. Le client (UI admin) fournit l'intention ; le serveur vérifie l'éligibilité. On évite ainsi qu'un admin passe accidentellement (ou volontairement) 60 jours à une invitation individuelle Tunnel A.

Deux valeurs discrètes uniquement, pas un TTL libre :

- absent / `false` → 7 jours (défaut actuel, comportement Tunnel A inchangé)
- `true` → 60 jours, **uniquement si `origine = 'migration'`** ; sinon 400 explicite

## Changements

### 1. Edge function `invite-prestataire`
- Accepter `long_ttl: boolean` (optionnel, défaut `false`) dans le body.
- Si `long_ttl === true` :
  - Vérifier que la fiche cible (existante ou en cours de mise à jour) a `origine = 'migration'`. Sinon renvoyer 400 « long_ttl réservé aux fiches migration ».
  - Appeler `signInvitationToken({ …, ttlSeconds: 60*60*24*60 })`.
- Sinon : appel inchangé (TTL 7 j par défaut du helper).
- Loguer dans `logs_admin` la durée retenue (`ttl_days: 7 | 60`) pour audit de campagne.

### 2. Edge function `resend-magic-link`
- Mêmes règles : accepter `long_ttl`, même garde-fou `origine = 'migration'`.
- Cela permet de relancer une fiche migration avec un lien frais également valable 60 jours, comme demandé (relance conservée comme filet de sécurité, pas de lien unique).

### 3. UI admin
- Sur la liste des prestataires, exposer l'option « invitation campagne migration (60 j) » **uniquement** pour les fiches dont `origine = 'migration'`. Pour toutes les autres, l'UI n'offre pas cette option — cohérent avec le garde-fou serveur.
- Une action de masse (« Inviter la sélection ») applique automatiquement `long_ttl: true` puisque la sélection est filtrée sur `origine = 'migration'`.

### 4. Helper `signInvitationToken`
- **Aucun changement.** Le défaut de 7 jours reste tel quel, aucun appelant qui ne précise pas `ttlSeconds` ne voit son comportement bouger.

## Ce qui reste identique

- Table `invitation_tokens`, `jti`, usage unique, colonnes probatoires immuables : inchangés.
- Route `/accept-invitation`, echange `verifyOtp` côté serveur, ouverture de session Supabase : inchangés.
- Tunnel A admin classique (invitation individuelle sans `long_ttl`) : 7 jours, aucune régression.
- Emails transactionnels : templates inchangés (le lien pointe toujours vers `/accept-invitation?token=…`).

## Validation prévue

- Test 1 : `invite-prestataire` sans `long_ttl` sur fiche non-migration → token `expires_at ≈ now + 7 j`. PASS attendu.
- Test 2 : `invite-prestataire` avec `long_ttl: true` sur fiche `origine = 'migration'` → token `expires_at ≈ now + 60 j`. PASS attendu.
- Test 3 : `invite-prestataire` avec `long_ttl: true` sur fiche `origine != 'migration'` → 400 explicite, aucun token émis. PASS attendu.
- Test 4 : `resend-magic-link` avec `long_ttl: true` sur fiche migration déjà invitée → nouveau token 60 j, ancien inchangé (usage unique préservé). PASS attendu.
- Test 5 : clic sur un lien 60 j après ~5 j → session ouverte normalement (le magic link Supabase est minté à la volée côté serveur, l'`email_otp_expiry` Supabase n'entre jamais en jeu côté utilisateur).

## Hors périmètre

- Modification du défaut global du helper.
- TTL libre côté client (on garde deux valeurs discrètes uniquement).
- Nouveau mécanisme de token ou nouvelle table : rien à créer.
