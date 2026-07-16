# Plan — Exemption de charte : publication + fin d'exemption

## Objectif

1. Rendre l'exemption `charte_exemptee_jusqua` effective comme condition d'entrée alternative à la signature dans le mécanisme de publication existant.
2. Ajouter un mécanisme quotidien qui suspend les fiches dont l'exemption expire sans charte signée.
3. Garantir la republication automatique à la signature pour un prestataire suspendu `charte_non_signee`.

Le garde-fou `prevent_direct_actif_write` reste **strictement inchangé**. Aucun nouveau chemin d'écriture directe de `statut='actif'` n'est introduit.

---

## 1. Assouplissement de la publication (dans le mécanisme existant)

Helper SQL immuable :

```sql
CREATE OR REPLACE FUNCTION public.charte_ok_pour_publication(
  p_charte_signee_le timestamptz,
  p_charte_exemptee_jusqua timestamptz
) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_charte_signee_le IS NOT NULL
      OR (p_charte_exemptee_jusqua IS NOT NULL AND p_charte_exemptee_jusqua > now());
$$;
```

Modification **uniquement à l'intérieur** des deux fonctions déclencheuses existantes (elles restent seules à `set_config('app.allow_actif_write','on')`) :

- `on_prestataire_validation()` (BEFORE UPDATE sur `prestataires`) : condition d'entrée devient
  `NEW.statut = 'validee' AND public.charte_ok_pour_publication(NEW.charte_signee_le, NEW.charte_exemptee_jusqua)` → bascule `NEW.statut := 'actif'`.
- `on_signature_charte_created()` (AFTER INSERT sur `signatures_charte`) : inchangée dans son cœur — une signature entraîne toujours le passage à `actif` si `statut='validee'`. **Ajout** : couvrir aussi le cas `statut='suspendu' AND motif_suspension='charte_non_signee'` (fiche restée validée éditorialement, suspendue pour exemption expirée) → repasser en `actif` et effacer `motif_suspension`, via le même chemin protégé `allow_actif_write`.

`prevent_direct_actif_write` : aucune modification. Toute autre écriture de `actif` reste rejetée.

---

## 2. Cron quotidien — fin d'exemption

Nouvelle Edge Function `cron-fin-exemption-charte` (calquée sur `cron-suspend-charte-obsolete`, `verify_jwt = false`) :

- Sélectionne `prestataires` où `statut='actif'`, `charte_signee_le IS NULL`, `charte_exemptee_jusqua IS NOT NULL AND charte_exemptee_jusqua <= now()`.
- Pour chaque fiche : `UPDATE ... SET statut='suspendu', motif_suspension='charte_non_signee'`. Valeurs réutilisées telles quelles depuis les enums existants. Le passage `actif → suspendu` ne heurte pas `prevent_direct_actif_write` (qui ne bloque que l'écriture *vers* `actif`).
- Envoie un email au prestataire via le circuit transactionnel existant : `supabase.functions.invoke('send-transactional-email', { templateName: 'suspension_charte_exemption_expiree', recipientEmail, idempotencyKey: 'fin-exemption-<prestataire_id>-<YYYY-MM-DD>', templateData: { nom_commercial, lien_signature } })`.

Nouveau template React Email `suspension-charte-exemption-expiree.tsx` sous `supabase/functions/_shared/transactional-email-templates/`, enregistré dans `registry.ts`. Contenu : information de la suspension + CTA vers `/signer-la-charte`. Aucun nouveau système d'envoi, aucun changement du dispatcher.

Planification via **pg_cron + pg_net** (même pattern que `email_queue_dispatch`, exécuté une fois par jour à 03:15 Europe/Paris ≈ 02:15 UTC) :

```sql
SELECT cron.schedule(
  'cron-fin-exemption-charte',
  '15 2 * * *',
  $$ SELECT net.http_post(
       url := 'https://<project>.supabase.co/functions/v1/cron-fin-exemption-charte',
       headers := jsonb_build_object('Content-Type','application/json',
                                     'Authorization','Bearer ' || <service_role via vault>),
       body := '{}'::jsonb
     ); $$
);
```

Idempotence : la requête est un no-op quand aucune fiche n'est éligible ; l'`idempotencyKey` datée bloque tout doublon d'email si la fonction est rejouée le même jour.

---

## 3. Réversibilité — republication à la signature

Cas ciblé : prestataire actuellement `suspendu` avec `motif_suspension='charte_non_signee'`, dont `statut_editorial`/preuve de validation reste acquise (la fiche a été `validee` avant d'être publiée puis suspendue).

Traité **exclusivement** dans `on_signature_charte_created()` (chemin protégé unique déjà existant) : lorsqu'une nouvelle signature arrive, si la fiche est dans cet état précis, on la repasse `actif` et on efface `motif_suspension`. Aucun autre code — ni RLS, ni UI, ni edge function — n'écrit `actif`.

---

## Détails techniques

### Migration SQL

1. `CREATE OR REPLACE FUNCTION public.charte_ok_pour_publication(...)`.
2. `CREATE OR REPLACE FUNCTION public.on_prestataire_validation()` — condition d'entrée élargie via le helper.
3. `CREATE OR REPLACE FUNCTION public.on_signature_charte_created()` — ajoute la branche « suspendu + charte_non_signee → actif ».
4. `cron.schedule('cron-fin-exemption-charte', ...)` via `supabase--insert` (contient l'URL projet + secret Vault, hors migration).

### Edge function

`supabase/functions/cron-fin-exemption-charte/index.ts` + entrée `verify_jwt = false` dans `supabase/config.toml`.

### Emails

- Template `suspension-charte-exemption-expiree.tsx` (React Email, charte visuelle existante).
- Enregistrement dans `registry.ts` sous la clé `suspension_charte_exemption_expiree`.
- Envoi via `send-transactional-email` uniquement (aucun nouveau path).

---

## Ce qui n'est PAS fait

- Aucune modification de `prevent_direct_actif_write`.
- Aucune modification abonnement / paiement / inscription / import.
- Aucun backfill.
- Aucun changement de RLS ou de UI admin (l'admin peut déjà poser/retirer l'exemption depuis l'étape précédente ; visualisation UI hors périmètre ici).
- Aucun changement de `cron-suspend-charte-obsolete` (couvre un cas distinct : nouvelle version de charte non re-signée).
