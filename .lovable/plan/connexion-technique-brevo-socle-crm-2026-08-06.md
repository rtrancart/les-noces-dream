# Connexion technique Brevo — socle CRM

## 1. Audit (état actuel, vérifié)

- **Aucune intégration Brevo** dans le projet : zéro occurrence de "brevo" dans le code, aucune Edge Function, aucun appel API.
- **Aucun secret Brevo** : la liste des secrets backend contient uniquement Lovable/Stripe/Supabase (`LOVABLE_API_KEY`, `STRIPE_*`, `SUPABASE_*`, `MAGIC_LINK_SECRET`, `PUBLIC_SITE_URL`, `REACTIVATION_TEAM_EMAIL`). Pas de `BREVO_API_KEY`.
- **Aucun connecteur** disponible/branché dans l'espace de travail (liste vide).
- **Existant marketing** : deux Edge Functions `mailchimp-add-tag` et `mailchimp-remove-tag`, qui sont des **stubs no-op** (elles loguent et renvoient `{success:true, stub:true}`, aucun appel externe). Une colonne `il_id text` existe sur une table de migration (identifiant d'outil marketing externe, non utilisé).
- **Transactionnel** : géré nativement (queue pgmq + `process-email-queue` + `send-transactional-email`). Rien à déplacer vers Brevo.

Conclusion : le tuyau Brevo est à créer entièrement, rien à réutiliser sauf le modèle de stub marketing (qui pourra plus tard être remplacé par de vrais appels Brevo).

## 2. Intention d'implémentation (canal de connexion + test)

### Secret
- Création du secret backend `BREVO_API_KEY` via le formulaire sécurisé (vous saisissez la valeur, elle n'apparaît jamais dans le code ni côté client).
- Aucune lecture côté navigateur : la clé n'est lue que par `Deno.env.get()` dans les Edge Functions.

### Client Brevo réutilisable
Nouveau module partagé `supabase/functions/_shared/brevo-client.ts` :
- `brevoFetch(path, init)` : construit l'appel sur `https://api.brevo.com/v3`, injecte l'en-tête `api-key`, `Content-Type` JSON.
- Normalisation des erreurs en un type unique `BrevoError { kind, status, message, retryAfterSeconds? }` avec `kind` parmi :
  - `missing_key` (secret absent)
  - `invalid_key` (401)
  - `forbidden` (403 — IP non autorisée / droits insuffisants)
  - `rate_limited` (429, lecture de `Retry-After`)
  - `unavailable` (5xx, timeout, erreur réseau)
  - `bad_request` (4xx autre)
- Politique de retry **paramétrable par appel** : `brevoFetch(path, init, { retries, timeoutMs })`.
  - Défaut (synchro) : timeout 10 s, backoff exponentiel sur `rate_limited` et `unavailable` uniquement, 2 tentatives max, jamais sur les erreurs d'authentification.
  - Mode « échec rapide » : `retries: 0` + timeout court, disponible pour tout appel interactif.
- Ce module sera le seul point d'appel Brevo : la future synchro contacts/attributs/événements passera par lui, avec le retry complet.


### Point d'entrée de test
Nouvelle Edge Function `brevo-test-connection` :
- Réservée aux admins : vérification du JWT + `has_role(admin|super_admin)`, sinon 403.
- Appelle `GET /v3/account` (lecture seule, aucun effet de bord) en **échec rapide** : `retries: 0`, timeout 5 s. Aucune attente de backoff — un Brevo indisponible remonte l'erreur en quelques secondes au lieu de 20-30 s.
- Réponse claire :
  ```json
  { "ok": true, "compte": { "email": "...", "companyName": "...", "plan": [...] } }
  ```
  ou en échec :
  ```json
  { "ok": false, "kind": "invalid_key", "status": 401, "message": "..." }
  ```
- Aucune donnée sensible (clé, en-têtes) loguée ou renvoyée.

### Vérification côté admin
- Petit encart « Connexion Brevo » dans le tableau de bord admin avec un bouton « Tester la connexion » affichant OK (vert, + nom du compte) ou l'échec avec son motif lisible en français.

### Hors périmètre (étapes suivantes)
Synchro des contacts, attributs custom, listes, push d'événements — non traités ici.

## 3. Détails techniques

- Fichiers créés : `supabase/functions/_shared/brevo-client.ts`, `supabase/functions/brevo-test-connection/index.ts`, `src/components/admin/BrevoConnectionPanel.tsx` (+ montage dans `src/pages/admin/Dashboard.tsx`).
- `supabase/config.toml` : `[functions.brevo-test-connection] verify_jwt = true`.
- Aucune migration de base, aucune modification des fonctions email existantes.
- Ordre d'exécution : je demanderai d'abord le secret `BREVO_API_KEY`, puis je déploierai la fonction et testerai la connexion réellement avant de vous rendre la main.
