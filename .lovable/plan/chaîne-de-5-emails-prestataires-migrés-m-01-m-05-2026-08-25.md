# Chaîne de 5 emails « prestataires migrés » (M-01 → M-05)

Chaîne transactionnelle dédiée aux fiches `origine = 'migration'`, jetable après la campagne de reprise du parc. Tous les migrés étant exemptés de charte, leur fiche est visible dès activation ; le M-05 les pousse à signer avant l'échéance de leur exemption.

## 1. Templates & contenus

- 5 nouveaux fichiers dans `supabase/functions/_shared/transactional-email-templates/` : `migration-m01-reactivation.tsx`, `migration-m02-relance.tsx`, `migration-m03-relance.tsx`, `migration-m04-relance.tsx`, `migration-m05-charte.tsx`.
- Corps HTML repris tel quel depuis les blocs `<!-- M-0X -->…<!-- /M-0X -->` du fichier fourni (sans header/footer/signature, ajoutés par le shell).
- Clés de registre : `migration_m01_reactivation`, `migration_m02_relance`, `migration_m03_relance`, `migration_m04_relance`, `migration_m05_charte`.
- Sujets et `previewData` conformes à la liste fournie ; variables : `nom_commercial`, `magic_link` (M-01→M-04), `charte_url` (M-01 et M-05), `charte_exemptee_jusqua` (M-05 seul, déjà formatée « 15 mars 2026 » côté appelant).
- Ajout des 5 entrées dans `SHELL_META` (`supabase/functions/_shared/email-shell.ts`) avec les preheaders fournis.
- Seed des 5 lignes dans `email_textes` via l'action `seed_missing` existante, `est_actif = true`.

## 2. Aiguillage M-01

Dans `supabase/functions/invite-prestataire/index.ts`, le `templateName` en dur devient `origine === 'migration' ? 'migration_m01_reactivation' : 'invitation_prestataire'`. `charte_url` ajoutée au `templateData` pour ce cas. Rien d'autre ne change : les fiches classiques gardent exactement le comportement actuel.

## 3. Migration SQL

- 5 colonnes `migration_m01_envoye_le` … `migration_m05_envoye_le` (timestamptz nullable) sur `prestataires`.
- Index partiels adaptés à la sélection des crons (fiches `origine = 'migration'` avec jalon non encore posé).

## 4. Cron de relance

Nouvelle Edge Function `cron-migration-relances`, service_role, paramétrée par `?step=m02|m03|m04|m05`, calquée sur `cron-relance-decouverte-j7` : sélection → verrou idempotent (`UPDATE … SET migration_mXX_envoye_le = now() WHERE id = … AND migration_mXX_envoye_le IS NULL RETURNING id`) → magic link frais (`invitation_tokens`) → `invoke send-transactional-email`.

Prédicats :

```text
M-02/03/04 : origine='migration' AND magic_link_envoye_le <= now() - 5|10|15 days
             AND premier_login_le IS NULL AND migration_mXX_envoye_le IS NULL
M-05       : origine='migration' AND premier_login_le <= now() - 3 days
             AND charte_signee_le IS NULL AND migration_m05_envoye_le IS NULL
```

M-05 ne filtre pas sur `charte_exemptee_jusqua` : les exemptés sont la cible. Seul critère d'arrêt : la signature. Le M-05 passe `charte_exemptee_jusqua` formatée en français sans heure.

Un seul job `pg_cron` quotidien enchaînant les 4 appels (`?step=`).

## 5. Exclusion anti-doublon

Ajout de `AND origine IS DISTINCT FROM 'migration'` (via `.neq`/filtre équivalent) dans `cron-relance-decouverte-j7` et `cron-dernier-contact-tunnel-a`, pour que les migrés ne reçoivent pas le tunnel A en plus de la chaîne M.

## 6. Expéditeur dédié

`send-transactional-email` : local-part du `from` rendue paramétrable (par défaut `noreply`), avec table de routage associant les 5 templates migration à `reactivation@notify.lesnoces.net`. `SENDER_DOMAIN` inchangé, aucun DNS, aucun sous-domaine.

## 7. Jetabilité

Le job cron est désactivable par une seule migration `cron.unschedule('...')`, commande documentée en commentaire dans la fonction. Colonnes de jalon et entrées `email_textes` peuvent rester en place sans effet.

## Fichiers concernés

Créés :
- 5 templates `migration-m0X-*.tsx`
- `supabase/functions/cron-migration-relances/index.ts`
- 1 migration SQL (colonnes + index) + 1 SQL de planification cron

Modifiés :
- `_shared/transactional-email-templates/registry.ts`
- `_shared/email-shell.ts` (SHELL_META)
- `invite-prestataire/index.ts` (aiguillage + `charte_url`)
- `send-transactional-email/index.ts` (from paramétrable)
- `cron-relance-decouverte-j7/index.ts`, `cron-dernier-contact-tunnel-a/index.ts` (exclusion migration)

Aucune nouvelle dépendance, aucun changement sur `email_send_log`, aucun impact sur les fiches non-migration.
