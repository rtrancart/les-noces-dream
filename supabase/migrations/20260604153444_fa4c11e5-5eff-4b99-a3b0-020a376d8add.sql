CREATE OR REPLACE FUNCTION public.prevent_signature_modification()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF COALESCE(current_setting('app.allow_signature_delete', true), 'off') = 'on' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Les signatures sont immuables et ne peuvent être supprimées (art. 11 Charte, convention de preuve).';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.prestataire_id IS DISTINCT FROM OLD.prestataire_id
       OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
       OR NEW.charte_version_id IS DISTINCT FROM OLD.charte_version_id
       OR NEW.charte_numero_version IS DISTINCT FROM OLD.charte_numero_version
       OR NEW.charte_hash IS DISTINCT FROM OLD.charte_hash
       OR NEW.signe_le IS DISTINCT FROM OLD.signe_le
       OR NEW.ip_signataire IS DISTINCT FROM OLD.ip_signataire
       OR NEW.user_agent IS DISTINCT FROM OLD.user_agent
       OR NEW.methode_auth IS DISTINCT FROM OLD.methode_auth
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Les colonnes probatoires d''une signature sont immuables (art. 11 Charte).';
    END IF;

    IF OLD.pdf_preuve_url IS NOT NULL AND NEW.pdf_preuve_url IS DISTINCT FROM OLD.pdf_preuve_url THEN
      RAISE EXCEPTION 'pdf_preuve_url ne peut être renseigné qu''une seule fois.';
    END IF;

    IF OLD.email_confirmation_envoye_le IS NOT NULL AND NEW.email_confirmation_envoye_le IS DISTINCT FROM OLD.email_confirmation_envoye_le THEN
      RAISE EXCEPTION 'email_confirmation_envoye_le ne peut être renseigné qu''une seule fois.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_user_cascade(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  PERFORM set_config('app.allow_signature_delete', 'on', true);
  DELETE FROM public.signatures_charte WHERE profile_id = p_user_id;
END;
$$;