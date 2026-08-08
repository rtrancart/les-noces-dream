CREATE OR REPLACE FUNCTION public.brevo_sync_contact_wake()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  BEGIN
    INSERT INTO public.brevo_sync_log (demande_id, kind)
    VALUES (NEW.id, 'contact_submitted')
    ON CONFLICT (demande_id, kind) WHERE demande_id IS NOT NULL DO NOTHING;

    PERFORM net.http_post(
      url := 'https://egbohbwiywgyyculswvf.supabase.co/functions/v1/brevo-sync-contact',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
        )
      ),
      body := jsonb_build_object('demande_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'brevo_sync_contact_wake failed (demande préservée): %', SQLERRM;
  END;

  RETURN NULL;
END;
$function$;