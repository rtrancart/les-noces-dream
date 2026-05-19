## Architecture définitive des statuts prestataires

Le modèle introduit un nouveau statut `a_completer`, sépare la dimension éditoriale (`statut`) de la dimension contractuelle (`charte_signee_le`), et verrouille `actif` au niveau de la base : seuls deux triggers peuvent l'écrire.

### 1. Migration base de données

**a) Enum `statut_prestataire`**

- `ALTER TYPE public.statut_prestataire ADD VALUE IF NOT EXISTS 'a_completer';`
- L'enum complet devient : `brouillon, pre_inscrit, a_completer, en_attente, a_corriger, validee, actif, suspendu, archive`.
- L'enum `motif_suspension_enum` est déjà conforme (`non_paiement, admin, archive, charte_non_signee, charte_obsolete`) — aucun changement.

**b) Migration de données ponctuelle**

- `UPDATE prestataires SET statut = 'a_completer' WHERE statut = 'pre_inscrit' AND premier_login_le IS NOT NULL;`
  → un prestataire déjà connecté n'est plus "pré-inscrit", il est "à compléter".

**c) Trigger verrou `actif` — `prevent_direct_actif_write`**

- `BEFORE INSERT OR UPDATE ON prestataires`.
- Lève `EXCEPTION 'Le statut actif ne peut être écrit que par les triggers on_charte_signed ou on_prestataire_validated'` si :
  - `NEW.statut = 'actif'` ET
  - le paramètre de session `app.allow_actif_write` n'est pas `'on'`.
- Les deux triggers autorisés font `PERFORM set_config('app.allow_actif_write', 'on', true);` (scope transaction) juste avant leur `UPDATE`.
- Aucun rôle (y compris `service_role` et `super_admin`) ne peut contourner.

**d) Trigger `on_prestataire_validated` (remplace `on_prestataire_validation`)**

- `BEFORE UPDATE ON prestataires`.
- Si `NEW.statut = 'validee'` ET `NEW.charte_signee_le IS NOT NULL` → `NEW.statut := 'actif'` après avoir activé le flag autorisé.

**e) Trigger `on_charte_signed` (remplace `on_signature_charte_created`)**

- `AFTER INSERT ON signatures_charte`.
- Met à jour `charte_signee_le` et `charte_version_signee` sur le prestataire.
- Si `statut = 'validee'` → bascule en `actif` via le flag autorisé.
- Ne touche jamais `a_completer`, `en_attente`, `pre_inscrit`, etc.

**f) Trigger d'audit `log_statut_transitions`** (bonus utile)

- `AFTER UPDATE OF statut ON prestataires` → insert dans `logs_admin` avec `action = 'statut_transition'`, ancien et nouveau statut, et `auth.uid()` si disponible.

### 2. Edge functions

**`sign-charte/index.ts`**

- Supprimer la création paresseuse de la fiche prestataire (la fiche existe déjà après signup, cf. point 3).
- Le patch sur `prestataires` ne contient plus que `notification_charte_obsolete_envoyee_le = null` et `motif_suspension = null`. Aucun changement de statut — le trigger `on_charte_signed` s'en charge.
- Si `presta.statut = 'archive'` et `motif_suspension = 'charte_non_signee'` → réponse 423 inchangée.

**`invite-prestataire/index.ts`**

- Continue d'écrire `statut: 'pre_inscrit'` quand l'admin envoie le magic link.
- À la première connexion du prestataire (handler `premier_login_le`), bascule automatique en `a_completer` (cf. point 3).

**`cron-archive-unsigned-prestataires/index.ts`**

- Élargit le filtre : `WHERE statut IN ('pre_inscrit', 'a_completer') AND charte_signee_le IS NULL AND premier_login_le < NOW() - INTERVAL '60 days'`.
- Bascule en `archive` + `motif_suspension = 'charte_non_signee'` (autorisé : pas `actif`).

**`cron-suspend-charte-obsolete/index.ts`** — pas de changement, n'écrit jamais `actif`.

### 3. Application : création de la fiche prestataire

La création paresseuse dans `sign-charte` disparaît. À la place :

- **Auto-inscription** : le handler `handle_new_user` (SECURITY DEFINER) détecte `role = 'prestataire'` dans les metadata et insère immédiatement une fiche `prestataires` minimale avec `statut = 'a_completer'`, `user_id`, `email_contact`, `nom_commercial = "Prestataire à compléter"`, `categorie_mere_id` par défaut, `slug` provisoire, `ville/region = "À compléter"`.
- **Pré-inscription admin** : l'admin crée explicitement la fiche → `statut = 'brouillon'`. Quand le magic link est envoyé → `statut = 'pre_inscrit'`. À la première connexion (mise à jour de `premier_login_le` dans un handler côté `AuthContext` ou edge function dédiée `on-first-login`) → bascule en `a_completer`.

### 4. Front-end

**`src/pages/admin/Prestataires.tsx`**

- Ajouter `a_completer` aux labels/couleurs/KPI (entre `pre_inscrit` et `en_attente`). Label : « À compléter ».
- Supprimer `actif` de la liste des valeurs sélectionnables dans le `<Select>` de mise à jour de statut et dans le formulaire de création/édition.
- Le bouton « Valider » écrit toujours `statut = 'validee'`. L'UI relit ensuite la fiche : si la lecture renvoie `actif` (trigger), afficher le badge « Actif » ; sinon afficher « Validée — En attente de signature charte ».
- Toute tentative d'écriture `actif` doit afficher un toast d'erreur explicite si le trigger lève (filet de sécurité).

**`src/components/prestataire/ProviderInfoBanner.tsx`**

- Ajouter `a_completer: "Profil à compléter"` dans `statusLabels`.
- Ajouter `a_completer: "bg-terracotta text-white …"` dans `statusClasses` (même tonalité que `pre_inscrit`).
- Ajouter un second badge "En attente de signature charte" (champagne) si `statut = 'validee'` et `charte_signee_le IS NULL`.

**`src/components/prestataire/WelcomeBanner.tsx`**

- Condition d'affichage : `statut ∈ {brouillon, pre_inscrit, a_completer}` (au lieu de `{brouillon, pre_inscrit}`).
- Checklist : item "Charte Qualité validée" devient **non bloquant** — visible mais cochable indépendamment, et **l'absence ne désactive pas** le bouton "Soumettre ma fiche" (cf. règle CAS 1).

**`src/components/auth/ChartePendingGuard.tsx`** (et redirections `/pro/charte`)

- La signature de la charte n'est plus un préalable obligatoire à l'accès à l'espace pro. Le guard devient un **rappel non bloquant** (bandeau persistant) plutôt qu'une redirection forcée.
- `CharteProgressive` reste accessible mais l'auto-redirection depuis `/espace-pro` doit être supprimée.

### 5. Tests à mettre à jour

- `supabase/functions/sign-charte/index_test.ts` : adapter le scénario "Cycle unifié" → `brouillon → pre_inscrit → a_completer → en_attente → validee → actif`, et vérifier qu'aucune tentative d'`UPDATE statut = 'actif'` directe ne réussit.

### 6. Mémoire projet

Mettre à jour `mem://logic/statuts-prestataires` (nouveau fichier) avec le tableau définitif et l'invariant `actif = (statut = validee) ∧ (charte_signee_le ≠ NULL)`, et ajouter une ligne Core dans `mem://index.md`.

---

### Détails techniques sur le verrou `actif`

```sql
CREATE OR REPLACE FUNCTION public.prevent_direct_actif_write()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.statut = 'actif'::statut_prestataire
     AND COALESCE(current_setting('app.allow_actif_write', true), 'off') <> 'on' THEN
    RAISE EXCEPTION
      'Statut actif interdit en écriture directe (utilisez le workflow validee + charte signée)';
  END IF;
  RETURN NEW;
END$$;

CREATE TRIGGER trg_prevent_direct_actif_write
BEFORE INSERT OR UPDATE OF statut ON public.prestataires
FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_actif_write();
```

Les deux triggers autorisés appellent `PERFORM set_config('app.allow_actif_write', 'on', true);` juste avant la bascule, ce qui est limité à la transaction courante (`is_local = true`) et indétectable depuis l'API.

### Ordre de déploiement

1. Migration SQL (enum + triggers + remplacement des deux triggers existants).
2. Migration de données (`pre_inscrit` connectés → `a_completer`).
3. Déploiement des edge functions modifiées.
4. Mise à jour front (labels, guards, banners, admin select).
5. Mise à jour de la mémoire projet.
