## Objectif

Préparer le modèle de données de `public.prestataires` pour la reprise du parc (~3 293 fiches) en ajoutant deux informations **indépendantes** :

1. **Origine de la fiche** (provenance immuable)
2. **Date d'exemption à la charte** (optionnelle, ponctuelle)

Aucun comportement de publication n'est modifié à cette étape — uniquement le schéma.

---

## 1. Origine de la fiche

Type ENUM `public.origine_prestataire` avec 3 valeurs :

- `inscription_admin` — fiche créée par l'équipe depuis le back-office (**valeur par défaut**, cas nominal)
- `auto_inscription` — le prestataire s'inscrit lui-même via le formulaire public
- `migration` — fiche reprise de l'ancien site

Colonne : `prestataires.origine origine_prestataire NOT NULL DEFAULT 'inscription_admin'`.

- Aucun backfill : fiches existantes → défaut. Les ~3293 fiches migrées seront marquées `migration` au moment de l'import. Les auto-inscriptions futures seront marquées `auto_inscription` par le code applicatif (étape suivante).
- **Immuabilité** : trigger `BEFORE UPDATE` rejetant toute modification de `origine`.
- **Coexistence** : `cree_par_admin` conservé tel quel, aucune synchronisation, pas de suppression.

---

## 2. Date d'exemption à la charte

Colonne : `prestataires.charte_exemptee_jusqua timestamptz NULL`.

- Cohérent avec les autres `timestamptz` (`charte_signee_le`, `fin_premium`).
- Nullable : absence = régime normal, présence = exemption jusqu'à cette date.
- Indépendante de `origine` — aucun couplage DB.
- Pas de contrainte de valeur, pas d'immuabilité (l'admin doit pouvoir poser/retirer/prolonger).

---

## Ce qui N'EST PAS fait à cette étape

- Aucune modification de `prestataires_public`, `on_prestataire_validation`, `prevent_direct_actif_write`, `handle_new_user`.
- Aucune règle de publication ni de bascule vers `statut = 'actif'` liée à l'exemption.
- Aucun backfill, aucun changement RLS, `cree_par_admin` inchangé.

---

## Migration SQL prévue

```sql
CREATE TYPE public.origine_prestataire AS ENUM (
  'inscription_admin',
  'auto_inscription',
  'migration'
);

ALTER TABLE public.prestataires
  ADD COLUMN origine public.origine_prestataire
    NOT NULL DEFAULT 'inscription_admin',
  ADD COLUMN charte_exemptee_jusqua timestamptz NULL;

CREATE OR REPLACE FUNCTION public.prevent_origine_prestataire_modification()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.origine IS DISTINCT FROM OLD.origine THEN
    RAISE EXCEPTION 'La colonne origine d''un prestataire est immuable après création.';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_prestataires_origine_immutable
  BEFORE UPDATE ON public.prestataires
  FOR EACH ROW EXECUTE FUNCTION public.prevent_origine_prestataire_modification();
```

Après approbation, régénération auto de `src/integrations/supabase/types.ts`. Aucun code applicatif modifié à cette étape.