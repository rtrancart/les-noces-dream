
# Relance J+7 — Tunnel A (prestataires sélectionnés par admin)

## Objectif
Envoyer une relance 7 jours après l'invitation initiale aux prestataires qui n'ont toujours pas activé leur compte, avec un nouveau magic link valide.

## 1. Nouveau template React Email

**Fichier** : `supabase/functions/_shared/transactional-email-templates/relance-decouverte-j7.tsx`

- `templateName` : `relance_decouverte_j7`
- `displayName` : « Relance découverte J+7 (Tunnel A) »
- Variables : `prenom`, `nom_commercial`, `magic_link`
- Sujet : `Votre profil vous attend toujours, {{prenom}}`
- Preview (pré-header) : `Votre profil est prêt, et vos 90 jours n'ont pas encore commencé.`
- Composant : conforme à la charte (Playfair Display titres, Montserrat corps, Or Riche #A57D27 accents/bouton, Bleu Abysse #0F141E titres, encart #FAF7F1 avec filet doré à gauche 3px). Structure :
  - Eyebrow « SÉLECTION LESNOCES » (Or Riche, tracking large, uppercase)
  - H1 « Votre place vous attend toujours »
  - Corps « Bonjour {{prenom}}, … » + paragraphe création profil
  - Encart mis en valeur (fond #FAF7F1, `borderLeft: 3px solid #A57D27`) avec la mention 90 jours gratuits
  - Bouton CTA centré → `{{magic_link}}`
  - `<Hr>` fin doré
  - Sous-titre « POURQUOI LESNOCES EST DIFFÉRENT »
  - Liste 4 items avec check doré ✓, intitulé gras + explication
  - Paragraphe italique gris avec email/téléphone 02 96 01 00 17
- Le header/footer/signature communs sont ajoutés automatiquement par `email-shell.ts` via `send-transactional-email` → **ne rien inclure dans le template**.

**Enregistrement** dans `supabase/functions/_shared/transactional-email-templates/registry.ts` : ajouter l'import et la clé `'relance_decouverte_j7'`.

## 2. Cron quotidien

**Nouvelle Edge Function** : `supabase/functions/cron-relance-decouverte-j7/index.ts`

Logique (modélisée sur `cron-relance-impaye-j7`) :
1. Sélectionner les `prestataires` où :
   - `statut = 'pre_inscrit'` (invité, jamais connecté — `premier_login_le IS NULL`)
   - `magic_link_envoye_le <= now() - 7 days`
   - `relance_decouverte_j7_envoye_le IS NULL` (nouvelle colonne, anti-doublon)
2. Pour chaque ligne :
   - Update préalable `relance_decouverte_j7_envoye_le = now()` avec garde `.is(null)` (verrou idempotent).
   - Générer un **nouveau** magic link signé via `signInvitationToken` (TTL = 60 jours si `origine = 'migration'`, sinon 7 jours), insérer la ligne `invitation_tokens` correspondante.
   - Appeler `send-transactional-email` avec `templateName: 'relance_decouverte_j7'`, `idempotencyKey: relance-j7-<prestataire_id>-<magic_link_envoye_le_iso>`.

Enregistrer `verify_jwt = false` dans `supabase/config.toml`.

## 3. Migration DB

Nouvelle colonne pour tracer l'envoi (anti-doublon) :
```sql
ALTER TABLE public.prestataires
  ADD COLUMN IF NOT EXISTS relance_decouverte_j7_envoye_le timestamptz;
```

## 4. Planification pg_cron

Insert (via `supabase.insert` sur `cron.job`) d'un job quotidien à 09:00 Europe/Paris (`0 8 * * *` UTC) qui appelle `cron-relance-decouverte-j7` avec l'`apikey` anon + Authorization service-role (schéma identique aux autres crons du projet).

## 5. Seed dans `email_textes`

Après déploiement, appeler `admin-email-textes` action `seed_missing` (déclenché automatiquement par l'onglet Emails du back-office au prochain chargement) pour créer la ligne éditable. La ligne apparaîtra ensuite dans la liste (« Cycle de vie prestataire »).

## 6. Déploiement

Déployer : `send-transactional-email`, `admin-email-textes`, `cron-relance-decouverte-j7`.

## Récap technique (résumé pour non-technicien)
- Un nouvel email « Relance découverte J+7 » sera créé.
- Il partira automatiquement, tous les jours, aux prestataires invités depuis 7 jours qui ne se sont pas connectés.
- Il contient un nouveau lien magique frais (le premier peut avoir expiré).
- Il apparaîtra dans l'onglet Emails du back-office et sera éditable comme les autres.
- Anti-doublon garanti : une seule relance J+7 par prestataire.
