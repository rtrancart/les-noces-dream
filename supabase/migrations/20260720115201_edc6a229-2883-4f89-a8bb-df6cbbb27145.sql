CREATE OR REPLACE FUNCTION public.log_statut_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := auth.uid();
BEGIN
  IF OLD.statut IS DISTINCT FROM NEW.statut THEN
    INSERT INTO public.logs_admin (admin_id, action, entite, entite_id, details)
    VALUES (
      COALESCE(v_admin, NEW.user_id, '00000000-0000-0000-0000-000000000000'::uuid),
      'statut_transition',
      'prestataires',
      NEW.id,
      jsonb_build_object(
        'ancien_statut', OLD.statut::text,
        'nouveau_statut', NEW.statut::text,
        'auto', v_admin IS NULL
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;