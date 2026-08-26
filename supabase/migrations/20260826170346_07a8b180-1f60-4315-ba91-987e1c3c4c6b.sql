ALTER TABLE public.prestataires
  ADD COLUMN IF NOT EXISTS compte_active_le timestamp with time zone;

UPDATE public.prestataires
SET compte_active_le = COALESCE(premier_login_le, updated_at, created_at)
WHERE user_id IS NOT NULL AND compte_active_le IS NULL;

CREATE OR REPLACE FUNCTION public.set_compte_active_le()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.user_id IS NULL)
     AND NEW.compte_active_le IS NULL THEN
    NEW.compte_active_le := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_compte_active_le ON public.prestataires;
CREATE TRIGGER trg_set_compte_active_le
BEFORE INSERT OR UPDATE OF user_id ON public.prestataires
FOR EACH ROW EXECUTE FUNCTION public.set_compte_active_le();

CREATE OR REPLACE FUNCTION public.brevo_prestataire_sync_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    -- Compte activé : rattachement d'un compte utilisateur à la fiche
    IF NEW.user_id IS NOT NULL AND OLD.user_id IS NULL THEN
      PERFORM public.brevo_sync_prestataire_wake(NEW.id, 'compte_active');
    END IF;

    IF NEW.date_premiere_publication IS NOT NULL
       AND OLD.date_premiere_publication IS NULL THEN
      PERFORM public.brevo_sync_prestataire_wake(NEW.id, 'fiche_published');
    ELSIF NEW.statut IS DISTINCT FROM OLD.statut
       OR NEW.email_contact IS DISTINCT FROM OLD.email_contact
       OR NEW.nom_commercial IS DISTINCT FROM OLD.nom_commercial
       OR NEW.region IS DISTINCT FROM OLD.region
       OR (NEW.user_id IS NOT NULL AND OLD.user_id IS NULL) THEN
      PERFORM public.brevo_sync_prestataire_wake(NEW.id, 'presta_sync');
    END IF;
  END IF;
  RETURN NULL;
END;
$$;