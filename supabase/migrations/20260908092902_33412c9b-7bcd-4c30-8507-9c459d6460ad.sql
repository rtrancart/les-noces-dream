ALTER TABLE public.abonnements
  ADD COLUMN IF NOT EXISTS promo_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_fin_le timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_promo_schedule_id text;

-- Éligibilité à l'offre de lancement 12 mois (P7).
-- Montants hardcodés : à synchroniser avec Stripe si changement.
CREATE OR REPLACE FUNCTION public.get_promo_eligibility(p_prestataire_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_presta       record;
  v_abo          record;
  v_deadline     timestamptz;
  v_promo_end    constant timestamptz := '2026-12-31T23:59:59Z'::timestamptz;
  v_prix_promo   constant jsonb := jsonb_build_object(
                    'standard_mensuel', 49,
                    'standard_annuel', 529,
                    'premium_mensuel', 89,
                    'premium_annuel', 960);
  v_prix_normaux constant jsonb := jsonb_build_object(
                    'standard_mensuel', 89,
                    'standard_annuel', 948,
                    'premium_mensuel', 149,
                    'premium_annuel', 1590);
  v_raison       text;
BEGIN
  SELECT id, user_id, origine INTO v_presta
  FROM public.prestataires WHERE id = p_prestataire_id;

  IF v_presta.id IS NULL THEN
    v_raison := 'prestataire_introuvable';
  ELSIF NOT (auth.uid() = v_presta.user_id
             OR public.has_role(auth.uid(), 'admin')
             OR public.has_role(auth.uid(), 'super_admin')) THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'raison_non_eligible', 'non_autorise',
      'date_limite', NULL,
      'jours_restants', NULL,
      'prix_promo', v_prix_promo,
      'prix_normaux', v_prix_normaux);
  ELSIF v_presta.origine IS DISTINCT FROM 'migration'::origine_prestataire THEN
    v_raison := 'non_migre';
  ELSIF now() >= v_promo_end THEN
    v_raison := 'offre_terminee';
  ELSE
    SELECT statut, fin_essai_le INTO v_abo
    FROM public.abonnements
    WHERE prestataire_id = p_prestataire_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_abo IS NULL THEN
      v_raison := 'aucun_abonnement';
    ELSIF v_abo.statut IS DISTINCT FROM 'trialing'::statut_abonnement THEN
      v_raison := 'essai_non_en_cours';
    ELSIF v_abo.fin_essai_le IS NULL THEN
      v_raison := 'compte_non_active';
    ELSIF now() >= v_abo.fin_essai_le THEN
      v_raison := 'essai_expire';
    END IF;
  END IF;

  IF v_raison IS NOT NULL THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'raison_non_eligible', v_raison,
      'date_limite', NULL,
      'jours_restants', NULL,
      'prix_promo', v_prix_promo,
      'prix_normaux', v_prix_normaux);
  END IF;

  v_deadline := least(v_abo.fin_essai_le, v_promo_end);

  RETURN jsonb_build_object(
    'eligible', true,
    'raison_non_eligible', NULL,
    'date_limite', v_deadline,
    'jours_restants', greatest(0, ceil(extract(epoch from (v_deadline - now())) / 86400))::int,
    'prix_promo', v_prix_promo,
    'prix_normaux', v_prix_normaux);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'eligible', false,
    'raison_non_eligible', 'erreur_interne',
    'date_limite', NULL,
    'jours_restants', NULL,
    'prix_promo', v_prix_promo,
    'prix_normaux', v_prix_normaux);
END;
$$;

REVOKE ALL ON FUNCTION public.get_promo_eligibility(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_promo_eligibility(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_promo_eligibility(uuid) TO service_role;