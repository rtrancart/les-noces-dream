ALTER TABLE public.logs_admin ALTER COLUMN admin_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.log_statut_transition()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_auteur uuid;
BEGIN
  IF OLD.statut IS DISTINCT FROM NEW.statut THEN
    IF v_uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid) THEN
      v_auteur := v_uid;
    ELSE
      v_auteur := NULL; -- auteur « système » (cron, webhook, trigger)
    END IF;
    INSERT INTO public.logs_admin (admin_id, action, entite, entite_id, details)
    VALUES (
      v_auteur, 'statut_transition', 'prestataires', NEW.id,
      jsonb_build_object(
        'ancien_statut', OLD.statut::text,
        'nouveau_statut', NEW.statut::text,
        'auto', v_auteur IS NULL,
        'auteur', CASE WHEN v_auteur IS NULL THEN 'systeme' ELSE 'utilisateur' END,
        'motif', NEW.motif_suspension::text,
        'sans_compte', NEW.user_id IS NULL
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.normaliser_cle_zone(text) SET search_path = public;
ALTER FUNCTION public.charte_ok_pour_publication(timestamptz, timestamptz) SET search_path = public;

CREATE SCHEMA IF NOT EXISTS backup;
REVOKE ALL ON SCHEMA backup FROM anon, authenticated;
CREATE TABLE backup.migration_photos_mapping_20260929 AS SELECT * FROM public.migration_photos_mapping;
DROP TABLE public.migration_photos_mapping;