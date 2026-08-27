CREATE OR REPLACE FUNCTION public.normaliser_region_prestataire()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_label text;
BEGIN
  IF NEW.region IS NULL OR btrim(NEW.region) = '' THEN
    RAISE EXCEPTION 'La region est obligatoire';
  END IF;

  IF NEW.region = 'a-renseigner' THEN
    RETURN NEW;
  END IF;

  SELECT z.label INTO v_label
  FROM public.zones_reference z
  WHERE z.type IN ('region', 'dom', 'pays')
    AND (
      replace(lower(z.slug), '-', '') = replace(lower(NEW.region), '-', '')
      OR replace(replace(lower(public.immutable_unaccent(z.label)), '-', ''), ' ', '')
         = replace(replace(lower(public.immutable_unaccent(NEW.region)), '-', ''), ' ', '')
    )
  LIMIT 1;

  IF v_label IS NULL THEN
    RAISE EXCEPTION 'Region invalide: "%". Utilisez un libelle du referentiel zones_reference.', NEW.region;
  END IF;

  NEW.region := v_label;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normaliser_region_prestataire ON public.prestataires;
CREATE TRIGGER trg_normaliser_region_prestataire
BEFORE INSERT OR UPDATE OF region ON public.prestataires
FOR EACH ROW
EXECUTE FUNCTION public.normaliser_region_prestataire();