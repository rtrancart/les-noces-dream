## Confirmations préalables

**1. Pattern flag ↔ non-renouvelabilité.** Oui, le pattern permet un blocage fin à deux niveaux :
- **Barrière 1 (flag requis)** : toute écriture (INSERT non-NULL, ou UPDATE modifiant la valeur) exige `app.allow_exemption_write = 'on'` → bloque tout PostgREST (admin/super_admin/owner) et tout code service_role qui n'a pas explicitement posé le flag.
- **Barrière 2 (règle métier, indépendante du flag)** : si `OLD.charte_exemptee_jusqua IS NOT NULL` et `NEW` diffère (autre date ou passage à NULL) → **RAISE inconditionnel**, même flag posé. Une exemption déjà consommée est immuable → non renouvelable, y compris pour un script service_role bien intentionné. Seul chemin d'écriture possible : `NULL → non-NULL` sous flag.

**2. Portée du trigger `BEFORE UPDATE OF charte_exemptee_jusqua`.** Confirmé : Postgres n'exécute un trigger `UPDATE OF colX` que si `colX` figure dans la clause `SET` de l'UPDATE (indépendamment de la valeur réellement changée). Un `UPDATE prestataires SET description=..., ville=...` ne le déclenche jamais. Zéro effet de bord sur les updates courants (profil, statut, photos, etc.). La branche INSERT reste `BEFORE INSERT` classique (déclenchée à chaque INSERT mais court-circuitée immédiatement si `NEW.charte_exemptee_jusqua IS NULL`, cas majoritaire).

**3. Contrôle `email_textes` pour `notif_nouvelle_version_charte`.** Ligne DB inspectée : le `corps_html` stocké **ne mentionne pas** « 15 jours » (ni aucun autre délai en dur). Il indique seulement « merci de relire les évolutions et de signer cette nouvelle version ». Le délai vit donc à **un seul endroit textuel** : le template TSX `notif-nouvelle-version-charte.tsx` (ligne 28). Aucune correction DB nécessaire — mais je remplace « 15 jours » par « 30 jours » dans le TSX pour cohérence.

Résumé : le délai vit techniquement à **deux endroits** (cron TS + template TSX), textuellement à **un seul** (template TSX). Les deux seront modifiés.

---

## Implémentation validée

### Demande 1 — Migration DB unique

```sql
CREATE OR REPLACE FUNCTION public.prevent_direct_exemption_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- INSERT avec valeur non-NULL : flag requis
  IF TG_OP = 'INSERT' THEN
    IF NEW.charte_exemptee_jusqua IS NOT NULL
       AND COALESCE(current_setting('app.allow_exemption_write', true), 'off') <> 'on' THEN
      RAISE EXCEPTION 'charte_exemptee_jusqua ne peut être posée que par un script de migration autorisé (flag app.allow_exemption_write).';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE : rien à faire si la colonne n'est pas modifiée
  IF NEW.charte_exemptee_jusqua IS NOT DISTINCT FROM OLD.charte_exemptee_jusqua THEN
    RETURN NEW;
  END IF;

  -- Règle métier : exemption non renouvelable, immuable une fois posée
  IF OLD.charte_exemptee_jusqua IS NOT NULL THEN
    RAISE EXCEPTION 'charte_exemptee_jusqua est immuable une fois posée : une exemption ne peut être ni modifiée, ni renouvelée, ni effacée.';
  END IF;

  -- Première pose (NULL → non-NULL) : flag requis
  IF COALESCE(current_setting('app.allow_exemption_write', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'charte_exemptee_jusqua ne peut être posée que par un script de migration autorisé (flag app.allow_exemption_write).';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_direct_exemption_write
  BEFORE INSERT OR UPDATE OF charte_exemptee_jusqua ON public.prestataires
  FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_exemption_write();
```

Aucune modif de policy, code TS, ou UI.

### Demande 2 — Deux fichiers

1. `supabase/functions/cron-suspend-charte-obsolete/index.ts`
   - Commentaire d'en-tête : `within 15 days` → `within 30 days`
   - `const fifteenDaysAgo = ... 15 * 24 * 3600 * 1000` → `const thirtyDaysAgo = ... 30 * 24 * 3600 * 1000`
   - `.lt("notification_charte_obsolete_envoyee_le", fifteenDaysAgo)` → `... thirtyDaysAgo`
2. `supabase/functions/_shared/transactional-email-templates/notif-nouvelle-version-charte.tsx`
   - Ligne 28 : `sous <strong>15 jours</strong>` → `sous <strong>30 jours</strong>`
3. `supabase/functions/sign-charte/index_test.ts`
   - Renommer les mentions « 15 jours » en « 30 jours » dans le commentaire ligne 11 et le nom de test ligne 180 (cohérence documentaire, comportement du test inchangé — il vérifie une notif > seuil).

Aucune modification `email_textes` (validé DB : pas de délai en dur).

Prêt à passer en implémentation dès votre feu vert.