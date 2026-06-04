CREATE OR REPLACE FUNCTION public.admin_delete_user_cascade(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_prestataire_ids uuid[] := ARRAY[]::uuid[];
  v_demande_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  IF v_admin_id = p_user_id THEN
    RAISE EXCEPTION 'Vous ne pouvez pas supprimer votre propre compte';
  END IF;

  IF NOT (public.has_role(v_admin_id, 'admin'::app_role) OR public.has_role(v_admin_id, 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_prestataire_ids
  FROM public.prestataires
  WHERE user_id = p_user_id;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_demande_ids
  FROM public.demandes_devis
  WHERE profile_id = p_user_id
     OR prestataire_id = ANY(v_prestataire_ids);

  PERFORM set_config('app.allow_signature_delete', 'on', true);

  DELETE FROM public.messages
  WHERE expediteur_id = p_user_id
     OR demande_id = ANY(v_demande_ids);

  DELETE FROM public.avis
  WHERE client_id = p_user_id
     OR demande_id = ANY(v_demande_ids)
     OR prestataire_id = ANY(v_prestataire_ids);

  DELETE FROM public.signatures_charte
  WHERE profile_id = p_user_id
     OR prestataire_id = ANY(v_prestataire_ids);

  DELETE FROM public.abonnements
  WHERE prestataire_id = ANY(v_prestataire_ids);

  DELETE FROM public.boosts_visibilite
  WHERE prestataire_id = ANY(v_prestataire_ids);

  DELETE FROM public.evenements_prestataire
  WHERE prestataire_id = ANY(v_prestataire_ids);

  DELETE FROM public.favoris
  WHERE user_id = p_user_id
     OR prestataire_id = ANY(v_prestataire_ids);

  DELETE FROM public.historique_navigation
  WHERE user_id = p_user_id
     OR prestataire_id = ANY(v_prestataire_ids);

  DELETE FROM public.demandes_devis
  WHERE id = ANY(v_demande_ids);

  UPDATE public.contacts_anonymes
  SET profile_id = NULL,
      updated_at = now()
  WHERE profile_id = p_user_id;

  DELETE FROM public.notifications
  WHERE user_id = p_user_id;

  DELETE FROM public.planificateur
  WHERE user_id = p_user_id;

  DELETE FROM public.invitation_tokens
  WHERE user_id = p_user_id;

  UPDATE public.articles_blog
  SET auteur_id = NULL,
      updated_at = now()
  WHERE auteur_id = p_user_id;

  UPDATE public.chartes_versions
  SET cree_par = NULL
  WHERE cree_par = p_user_id;

  UPDATE public.logs_admin
  SET admin_id = v_admin_id,
      details = COALESCE(details, '{}'::jsonb) || jsonb_build_object(
        'admin_id_supprime', p_user_id,
        'admin_id_reassigne_a', v_admin_id,
        'reassigne_le', now()
      )
  WHERE admin_id = p_user_id;

  DELETE FROM public.prestataires
  WHERE id = ANY(v_prestataire_ids);

  DELETE FROM public.user_roles
  WHERE user_id = p_user_id;

  DELETE FROM public.profiles
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user_cascade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_cascade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_cascade(uuid) TO service_role;