-- 1. Recreate the immutability trigger function WITHOUT the pdf_preuve_url reference.
--    All other probatory columns remain strictly immutable (art. 11 Charte).
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

    IF OLD.email_confirmation_envoye_le IS NOT NULL AND NEW.email_confirmation_envoye_le IS DISTINCT FROM OLD.email_confirmation_envoye_le THEN
      RAISE EXCEPTION 'email_confirmation_envoye_le ne peut être renseigné qu''une seule fois.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Drop the now-unused column.
ALTER TABLE public.signatures_charte DROP COLUMN IF EXISTS pdf_preuve_url;
