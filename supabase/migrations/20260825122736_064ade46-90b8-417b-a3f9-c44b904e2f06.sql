CREATE OR REPLACE FUNCTION public.brevo_prestataire_sync_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.brevo_sync_prestataire_wake(NEW.id, 'presta_sync');
    -- Entrée dans le tunnel d'inscription (hors reprise de parc)
    IF NEW.origine IN ('inscription_admin'::public.origine_prestataire,
                       'auto_inscription'::public.origine_prestataire) THEN
      PERFORM public.brevo_sync_prestataire_wake(NEW.id, 'subscription_started');
    END IF;
    IF NEW.date_premiere_publication IS NOT NULL THEN
      PERFORM public.brevo_sync_prestataire_wake(NEW.id, 'fiche_published');
    END IF;
  ELSE
    -- Invitation envoyée : entrée dans le tunnel pour les fiches migrées / créées avant invitation
    IF NEW.magic_link_envoye_le IS NOT NULL
       AND OLD.magic_link_envoye_le IS NULL THEN
      PERFORM public.brevo_sync_prestataire_wake(NEW.id, 'subscription_started');
    END IF;

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

CREATE OR REPLACE FUNCTION public.brevo_abonnement_sync_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.statut IS DISTINCT FROM OLD.statut
     OR NEW.fin_essai_le IS DISTINCT FROM OLD.fin_essai_le THEN
    PERFORM public.brevo_sync_prestataire_wake(NEW.prestataire_id, 'presta_sync');
  END IF;
  RETURN NULL;
END;
$function$;