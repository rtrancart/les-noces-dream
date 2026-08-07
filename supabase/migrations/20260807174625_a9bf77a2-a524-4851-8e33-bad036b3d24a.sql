-- 1) Journal Brevo mutualisé (demande OU prestataire)
ALTER TABLE public.brevo_sync_log ALTER COLUMN demande_id DROP NOT NULL;
ALTER TABLE public.brevo_sync_log
  ADD COLUMN IF NOT EXISTS prestataire_id uuid REFERENCES public.prestataires(id) ON DELETE CASCADE;
ALTER TABLE public.brevo_sync_log
  ADD CONSTRAINT brevo_sync_log_cible_chk CHECK (num_nonnulls(demande_id, prestataire_id) = 1);

DROP INDEX IF EXISTS public.brevo_sync_log_demande_kind_key;
CREATE UNIQUE INDEX brevo_sync_log_demande_kind_key
  ON public.brevo_sync_log (demande_id, kind) WHERE demande_id IS NOT NULL;
CREATE UNIQUE INDEX brevo_sync_log_presta_kind_key
  ON public.brevo_sync_log (prestataire_id, kind) WHERE prestataire_id IS NOT NULL;

-- 2) Empreinte non lisible du dernier email poussé vers Brevo
ALTER TABLE public.prestataires ADD COLUMN IF NOT EXISTS brevo_email_hash text;

-- 3) date_premiere_publication posée au premier passage en actif
CREATE OR REPLACE FUNCTION public.on_prestataire_validation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.statut = 'validee'::public.statut_prestataire
     AND public.charte_ok_pour_publication(NEW.charte_signee_le, NEW.charte_exemptee_jusqua) THEN
    PERFORM set_config('app.allow_actif_write', 'on', true);
    NEW.statut := 'actif'::public.statut_prestataire;
  END IF;

  IF NEW.statut = 'actif'::public.statut_prestataire THEN
    NEW.date_premiere_publication := COALESCE(NEW.date_premiere_publication, now());
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.on_signature_charte_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_statut public.statut_prestataire;
  v_motif public.motif_suspension_enum;
BEGIN
  SELECT statut, motif_suspension
    INTO v_statut, v_motif
    FROM public.prestataires
   WHERE id = NEW.prestataire_id;

  IF v_statut = 'validee'::public.statut_prestataire THEN
    PERFORM set_config('app.allow_actif_write', 'on', true);
    UPDATE public.prestataires SET
      charte_signee_le      = NEW.signe_le,
      charte_version_signee = NEW.charte_numero_version,
      statut                = 'actif'::public.statut_prestataire,
      date_premiere_publication = COALESCE(date_premiere_publication, now())
    WHERE id = NEW.prestataire_id;
  ELSIF v_statut = 'suspendu'::public.statut_prestataire
        AND v_motif = 'charte_non_signee'::public.motif_suspension_enum THEN
    PERFORM set_config('app.allow_actif_write', 'on', true);
    UPDATE public.prestataires SET
      charte_signee_le      = NEW.signe_le,
      charte_version_signee = NEW.charte_numero_version,
      statut                = 'actif'::public.statut_prestataire,
      motif_suspension      = NULL,
      date_premiere_publication = COALESCE(date_premiere_publication, now())
    WHERE id = NEW.prestataire_id;
  ELSE
    UPDATE public.prestataires SET
      charte_signee_le      = NEW.signe_le,
      charte_version_signee = NEW.charte_numero_version
    WHERE id = NEW.prestataire_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4) Réveil non bloquant de la synchro Brevo prestataire
CREATE OR REPLACE FUNCTION public.brevo_sync_prestataire_wake(p_prestataire_id uuid, p_kind text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  BEGIN
    INSERT INTO public.brevo_sync_log (prestataire_id, kind)
    VALUES (p_prestataire_id, p_kind)
    ON CONFLICT (prestataire_id, kind) WHERE prestataire_id IS NOT NULL DO NOTHING;

    PERFORM net.http_post(
      url := 'https://egbohbwiywgyyculswvf.supabase.co/functions/v1/brevo-sync-prestataire',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
        )
      ),
      body := jsonb_build_object('prestataire_id', p_prestataire_id, 'kind', p_kind)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'brevo_sync_prestataire_wake failed (opération préservée): %', SQLERRM;
  END;
END;
$function$;

-- 5) Trigger fiches prestataires
CREATE OR REPLACE FUNCTION public.brevo_prestataire_sync_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.brevo_sync_prestataire_wake(NEW.id, 'presta_sync');
    IF NEW.date_premiere_publication IS NOT NULL THEN
      PERFORM public.brevo_sync_prestataire_wake(NEW.id, 'fiche_published');
    END IF;
  ELSE
    IF NEW.date_premiere_publication IS NOT NULL
       AND OLD.date_premiere_publication IS NULL THEN
      PERFORM public.brevo_sync_prestataire_wake(NEW.id, 'fiche_published');
    ELSIF NEW.statut IS DISTINCT FROM OLD.statut
       OR NEW.email_contact IS DISTINCT FROM OLD.email_contact
       OR NEW.nom_commercial IS DISTINCT FROM OLD.nom_commercial
       OR NEW.region IS DISTINCT FROM OLD.region THEN
      PERFORM public.brevo_sync_prestataire_wake(NEW.id, 'presta_sync');
    END IF;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_brevo_sync_prestataire ON public.prestataires;
CREATE TRIGGER trg_brevo_sync_prestataire
AFTER INSERT OR UPDATE ON public.prestataires
FOR EACH ROW EXECUTE FUNCTION public.brevo_prestataire_sync_trigger();

-- 6) Trigger abonnements
CREATE OR REPLACE FUNCTION public.brevo_abonnement_sync_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.statut = 'actif'::public.statut_abonnement
     AND (TG_OP = 'INSERT' OR OLD.statut IS DISTINCT FROM 'actif'::public.statut_abonnement) THEN
    PERFORM public.brevo_sync_prestataire_wake(NEW.prestataire_id, 'subscription_started');
  ELSIF TG_OP = 'INSERT'
     OR NEW.statut IS DISTINCT FROM OLD.statut
     OR NEW.fin_essai_le IS DISTINCT FROM OLD.fin_essai_le THEN
    PERFORM public.brevo_sync_prestataire_wake(NEW.prestataire_id, 'presta_sync');
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_brevo_sync_abonnement ON public.abonnements;
CREATE TRIGGER trg_brevo_sync_abonnement
AFTER INSERT OR UPDATE ON public.abonnements
FOR EACH ROW EXECUTE FUNCTION public.brevo_abonnement_sync_trigger();