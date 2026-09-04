ALTER TABLE public.champs_categories ALTER COLUMN categorie_id DROP NOT NULL;

ALTER TYPE public.type_champ ADD VALUE IF NOT EXISTS 'multi_choix';

ALTER TABLE public.champs_categories
  ADD COLUMN IF NOT EXISTS groupe text,
  ADD COLUMN IF NOT EXISTS filtrable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS condition_cle text,
  ADD COLUMN IF NOT EXISTS condition_valeur text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_champs_categories_updated_at ON public.champs_categories;
CREATE TRIGGER update_champs_categories_updated_at
  BEFORE UPDATE ON public.champs_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX IF NOT EXISTS champs_categories_cle_categorie_uniq
  ON public.champs_categories (categorie_id, cle)
  WHERE categorie_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS champs_categories_cle_commune_uniq
  ON public.champs_categories (cle)
  WHERE categorie_id IS NULL;

CREATE INDEX IF NOT EXISTS champs_categories_categorie_id_idx
  ON public.champs_categories (categorie_id);

CREATE INDEX IF NOT EXISTS prestataires_champs_specifiques_gin_idx
  ON public.prestataires USING gin (champs_specifiques);