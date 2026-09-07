CREATE OR REPLACE FUNCTION public.check_limite_photos_selon_formule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_avant integer;
  v_apres integer;
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.est_premium, false) THEN
    RETURN NEW;
  END IF;

  SELECT cardinality(
    ARRAY(
      SELECT DISTINCT u FROM unnest(
        COALESCE(OLD.urls_galerie, '{}') ||
        CASE WHEN OLD.photo_principale_url IS NULL THEN '{}'::text[]
             ELSE ARRAY[OLD.photo_principale_url] END
      ) AS u
    )
  ) INTO v_avant;

  SELECT cardinality(
    ARRAY(
      SELECT DISTINCT u FROM unnest(
        COALESCE(NEW.urls_galerie, '{}') ||
        CASE WHEN NEW.photo_principale_url IS NULL THEN '{}'::text[]
             ELSE ARRAY[NEW.photo_principale_url] END
      ) AS u
    )
  ) INTO v_apres;

  IF v_apres > 10 AND v_apres > COALESCE(v_avant, 0) THEN
    RAISE EXCEPTION 'Limite de 10 photos atteinte : la formule Premium permet d''en publier davantage';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_check_limite_photos ON public.prestataires;
CREATE TRIGGER trg_check_limite_photos
BEFORE UPDATE OF urls_galerie, photo_principale_url ON public.prestataires
FOR EACH ROW EXECUTE FUNCTION public.check_limite_photos_selon_formule();