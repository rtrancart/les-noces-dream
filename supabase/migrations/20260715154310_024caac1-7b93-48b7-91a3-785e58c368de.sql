
-- 1. Extension de l'enum plan_abonnement
ALTER TYPE public.plan_abonnement ADD VALUE IF NOT EXISTS 'standard_mensuel';
ALTER TYPE public.plan_abonnement ADD VALUE IF NOT EXISTS 'premium_mensuel';

-- 2. Nouvelles colonnes sur abonnements
ALTER TABLE public.abonnements
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspendu_pour_impaye_le timestamptz NULL;

-- 3. Fonction de réactivation post-paiement (bypass du trigger prevent_direct_actif_write)
CREATE OR REPLACE FUNCTION public.reactiver_prestataire_paiement(p_prestataire_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.allow_actif_write', 'on', true);
  UPDATE public.prestataires
    SET statut = 'actif'::public.statut_prestataire
    WHERE id = p_prestataire_id
      AND statut = 'suspendu'::public.statut_prestataire;
END;
$$;

REVOKE ALL ON FUNCTION public.reactiver_prestataire_paiement(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reactiver_prestataire_paiement(uuid) TO service_role;
