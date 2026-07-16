CREATE TYPE public.origine_prestataire AS ENUM (
  'inscription_admin',
  'auto_inscription',
  'migration'
);

ALTER TABLE public.prestataires
  ADD COLUMN origine public.origine_prestataire NOT NULL DEFAULT 'inscription_admin',
  ADD COLUMN charte_exemptee_jusqua timestamptz NULL;

CREATE OR REPLACE FUNCTION public.prevent_origine_prestataire_modification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.origine IS DISTINCT FROM OLD.origine THEN
    RAISE EXCEPTION 'La colonne origine d''un prestataire est immuable après création.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prestataires_origine_immutable ON public.prestataires;
CREATE TRIGGER trg_prestataires_origine_immutable
  BEFORE UPDATE ON public.prestataires
  FOR EACH ROW EXECUTE FUNCTION public.prevent_origine_prestataire_modification();