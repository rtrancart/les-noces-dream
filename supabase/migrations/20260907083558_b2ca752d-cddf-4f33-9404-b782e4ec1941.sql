CREATE TYPE public.formule_abonnement AS ENUM ('standard', 'premium');
CREATE TYPE public.periodicite_abonnement AS ENUM ('mensuel', 'annuel');

ALTER TABLE public.abonnements
  ADD COLUMN formule public.formule_abonnement NOT NULL DEFAULT 'standard',
  ADD COLUMN periodicite public.periodicite_abonnement NOT NULL DEFAULT 'mensuel';

CREATE INDEX idx_abonnements_prestataire_formule_statut
  ON public.abonnements (prestataire_id, formule, statut);

CREATE OR REPLACE FUNCTION public.sync_est_premium_from_abonnement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prestataire_id uuid;
  v_premium boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_prestataire_id := OLD.prestataire_id;
  ELSE
    v_prestataire_id := NEW.prestataire_id;
  END IF;

  IF v_prestataire_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.abonnements a
    WHERE a.prestataire_id = v_prestataire_id
      AND a.formule = 'premium'::public.formule_abonnement
      AND a.statut = 'actif'::public.statut_abonnement
  ) INTO v_premium;

  UPDATE public.prestataires
  SET est_premium = v_premium
  WHERE id = v_prestataire_id
    AND est_premium IS DISTINCT FROM v_premium;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_est_premium_ai
  AFTER INSERT ON public.abonnements
  FOR EACH ROW EXECUTE FUNCTION public.sync_est_premium_from_abonnement();

CREATE TRIGGER trg_sync_est_premium_au
  AFTER UPDATE OF formule, statut ON public.abonnements
  FOR EACH ROW EXECUTE FUNCTION public.sync_est_premium_from_abonnement();

CREATE TRIGGER trg_sync_est_premium_ad
  AFTER DELETE ON public.abonnements
  FOR EACH ROW EXECUTE FUNCTION public.sync_est_premium_from_abonnement();