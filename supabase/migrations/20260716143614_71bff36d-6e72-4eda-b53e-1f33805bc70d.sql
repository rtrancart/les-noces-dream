
CREATE OR REPLACE FUNCTION public.charte_ok_pour_publication(
  p_charte_signee_le timestamptz,
  p_charte_exemptee_jusqua timestamptz
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_charte_signee_le IS NOT NULL
      OR (p_charte_exemptee_jusqua IS NOT NULL AND p_charte_exemptee_jusqua > now());
$$;

CREATE OR REPLACE FUNCTION public.on_prestataire_validation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.statut = 'validee'::public.statut_prestataire
     AND public.charte_ok_pour_publication(NEW.charte_signee_le, NEW.charte_exemptee_jusqua) THEN
    PERFORM set_config('app.allow_actif_write', 'on', true);
    NEW.statut := 'actif'::public.statut_prestataire;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_signature_charte_created()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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
      statut                = 'actif'::public.statut_prestataire
    WHERE id = NEW.prestataire_id;
  ELSIF v_statut = 'suspendu'::public.statut_prestataire
        AND v_motif = 'charte_non_signee'::public.motif_suspension_enum THEN
    -- Republication automatique : la fiche avait été suspendue pour exemption expirée.
    -- Seul chemin protégé : allow_actif_write posé ici, prevent_direct_actif_write inchangé.
    PERFORM set_config('app.allow_actif_write', 'on', true);
    UPDATE public.prestataires SET
      charte_signee_le      = NEW.signe_le,
      charte_version_signee = NEW.charte_numero_version,
      statut                = 'actif'::public.statut_prestataire,
      motif_suspension      = NULL
    WHERE id = NEW.prestataire_id;
  ELSE
    UPDATE public.prestataires SET
      charte_signee_le      = NEW.signe_le,
      charte_version_signee = NEW.charte_numero_version
    WHERE id = NEW.prestataire_id;
  END IF;

  RETURN NEW;
END;
$$;
