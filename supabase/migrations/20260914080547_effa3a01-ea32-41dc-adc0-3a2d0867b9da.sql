-- 1. Nouvelle définition : activation = première connexion réelle
CREATE OR REPLACE FUNCTION public.set_compte_active_le()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.premier_login_le IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.premier_login_le IS NULL)
     AND NEW.compte_active_le IS NULL THEN
    NEW.compte_active_le := NEW.premier_login_le;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Événement CRM « compte_active » déclenché sur la première connexion
CREATE OR REPLACE FUNCTION public.brevo_prestataire_sync_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.brevo_sync_prestataire_wake(NEW.id, 'presta_sync');
    IF NEW.origine IN ('inscription_admin'::public.origine_prestataire,
                       'auto_inscription'::public.origine_prestataire) THEN
      PERFORM public.brevo_sync_prestataire_wake(NEW.id, 'subscription_started');
    END IF;
    IF NEW.date_premiere_publication IS NOT NULL THEN
      PERFORM public.brevo_sync_prestataire_wake(NEW.id, 'fiche_published');
    END IF;
  ELSE
    IF NEW.magic_link_envoye_le IS NOT NULL
       AND OLD.magic_link_envoye_le IS NULL THEN
      PERFORM public.brevo_sync_prestataire_wake(NEW.id, 'subscription_started');
    END IF;

    -- Compte réellement activé : première connexion du prestataire
    IF NEW.premier_login_le IS NOT NULL AND OLD.premier_login_le IS NULL THEN
      PERFORM public.brevo_sync_prestataire_wake(NEW.id, 'compte_active');
    END IF;

    IF NEW.date_premiere_publication IS NOT NULL
       AND OLD.date_premiere_publication IS NULL THEN
      PERFORM public.brevo_sync_prestataire_wake(NEW.id, 'fiche_published');
    ELSIF NEW.statut IS DISTINCT FROM OLD.statut
       OR NEW.email_contact IS DISTINCT FROM OLD.email_contact
       OR NEW.nom_commercial IS DISTINCT FROM OLD.nom_commercial
       OR NEW.region IS DISTINCT FROM OLD.region
       OR (NEW.premier_login_le IS NOT NULL AND OLD.premier_login_le IS NULL) THEN
      PERFORM public.brevo_sync_prestataire_wake(NEW.id, 'presta_sync');
    END IF;
  END IF;
  RETURN NULL;
END;
$function$;

-- 3. Réalignement des données existantes
UPDATE public.prestataires
SET compte_active_le = premier_login_le
WHERE premier_login_le IS NOT NULL
  AND compte_active_le IS DISTINCT FROM premier_login_le;

UPDATE public.prestataires
SET compte_active_le = NULL
WHERE premier_login_le IS NULL
  AND compte_active_le IS NOT NULL;