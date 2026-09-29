CREATE OR REPLACE FUNCTION public.log_statut_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_auteur uuid;
BEGIN
  IF OLD.statut IS DISTINCT FROM NEW.statut THEN
    v_auteur := COALESCE(v_admin, NEW.user_id);
    IF v_auteur IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_auteur) THEN
      SELECT ur.user_id INTO v_auteur FROM public.user_roles ur
        JOIN public.profiles pr ON pr.id = ur.user_id
       WHERE ur.role = 'super_admin' ORDER BY ur.user_id LIMIT 1;
    END IF;
    IF v_auteur IS NOT NULL THEN
      INSERT INTO public.logs_admin (admin_id, action, entite, entite_id, details)
      VALUES (
        v_auteur, 'statut_transition', 'prestataires', NEW.id,
        jsonb_build_object(
          'ancien_statut', OLD.statut::text,
          'nouveau_statut', NEW.statut::text,
          'auto', v_admin IS NULL,
          'sans_compte', NEW.user_id IS NULL
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;