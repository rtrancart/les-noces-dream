CREATE OR REPLACE FUNCTION public.valider_prestataire_migre(p_prestataire_id uuid)
RETURNS TABLE(
  id uuid,
  nom_commercial text,
  slug text,
  statut statut_prestataire,
  user_id uuid,
  email_contact text,
  charte_exemptee_jusqua timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.prestataires;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Accès refusé : action réservée aux administrateurs.';
  END IF;

  SELECT * INTO v_row FROM public.prestataires p WHERE p.id = p_prestataire_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Prestataire introuvable';
  END IF;

  IF v_row.origine <> 'migration' THEN
    RAISE EXCEPTION 'Fiche non issue de la migration : exemption de charte non applicable.';
  END IF;

  IF v_row.charte_signee_le IS NULL AND v_row.charte_exemptee_jusqua IS NULL THEN
    PERFORM set_config('app.allow_exemption_write', 'on', true);
    UPDATE public.prestataires
      SET charte_exemptee_jusqua = now() + interval '90 days'
      WHERE public.prestataires.id = p_prestataire_id;
    PERFORM set_config('app.allow_exemption_write', 'off', true);
  END IF;

  UPDATE public.prestataires
    SET statut = 'validee'
    WHERE public.prestataires.id = p_prestataire_id;

  RETURN QUERY
    SELECT p.id, p.nom_commercial, p.slug, p.statut, p.user_id, p.email_contact, p.charte_exemptee_jusqua
    FROM public.prestataires p
    WHERE p.id = p_prestataire_id;
END;
$$;

REVOKE ALL ON FUNCTION public.valider_prestataire_migre(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valider_prestataire_migre(uuid) TO authenticated;