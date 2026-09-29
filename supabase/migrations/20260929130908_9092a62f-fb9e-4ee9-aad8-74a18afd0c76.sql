DROP FUNCTION public.appliquer_verification_emails(jsonb);

DROP FUNCTION public.admin_delete_user_cascade(uuid);
CREATE FUNCTION public.admin_delete_user_cascade(p_user_id uuid, p_admin_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id uuid := p_admin_id;
  v_prestataire_ids uuid[] := ARRAY[]::uuid[];
  v_demande_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF v_admin_id IS NULL THEN RAISE EXCEPTION 'Non autorisé'; END IF;
  IF v_admin_id = p_user_id THEN RAISE EXCEPTION 'Vous ne pouvez pas supprimer votre propre compte'; END IF;
  IF NOT (public.has_role(v_admin_id, 'admin'::app_role) OR public.has_role(v_admin_id, 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_prestataire_ids FROM public.prestataires WHERE user_id = p_user_id;
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_demande_ids FROM public.demandes_devis
   WHERE profile_id = p_user_id OR prestataire_id = ANY(v_prestataire_ids);

  PERFORM set_config('app.allow_signature_delete', 'on', true);

  DELETE FROM public.messages WHERE expediteur_id = p_user_id OR demande_id = ANY(v_demande_ids);
  DELETE FROM public.avis WHERE client_id = p_user_id OR demande_id = ANY(v_demande_ids) OR prestataire_id = ANY(v_prestataire_ids);
  DELETE FROM public.signatures_charte WHERE profile_id = p_user_id OR prestataire_id = ANY(v_prestataire_ids);
  DELETE FROM public.abonnements WHERE prestataire_id = ANY(v_prestataire_ids);
  DELETE FROM public.boosts_visibilite WHERE prestataire_id = ANY(v_prestataire_ids);
  DELETE FROM public.evenements_prestataire WHERE prestataire_id = ANY(v_prestataire_ids);
  DELETE FROM public.favoris WHERE user_id = p_user_id OR prestataire_id = ANY(v_prestataire_ids);
  DELETE FROM public.historique_navigation WHERE user_id = p_user_id OR prestataire_id = ANY(v_prestataire_ids);
  DELETE FROM public.demandes_devis WHERE id = ANY(v_demande_ids);
  UPDATE public.contacts_anonymes SET profile_id = NULL, updated_at = now() WHERE profile_id = p_user_id;
  DELETE FROM public.notifications WHERE user_id = p_user_id;
  DELETE FROM public.planificateur WHERE user_id = p_user_id;
  DELETE FROM public.invitation_tokens WHERE user_id = p_user_id;
  UPDATE public.articles_blog SET auteur_id = NULL, updated_at = now() WHERE auteur_id = p_user_id;
  UPDATE public.chartes_versions SET cree_par = NULL WHERE cree_par = p_user_id;
  UPDATE public.logs_admin
     SET admin_id = v_admin_id,
         details = COALESCE(details, '{}'::jsonb) || jsonb_build_object('admin_id_supprime', p_user_id, 'admin_id_reassigne_a', v_admin_id, 'reassigne_le', now())
   WHERE admin_id = p_user_id;
  DELETE FROM public.prestataires WHERE id = ANY(v_prestataire_ids);
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE id = p_user_id;
END;
$function$;

-- Réservées au système
REVOKE EXECUTE ON FUNCTION public.admin_delete_user_cascade(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.brevo_compteurs_prestataires(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculer_tous_les_scores(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purger_historique_navigation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculer_taux_reponse(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculer_score_classement(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculer_score_classement_for_row(public.prestataires) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_cascade(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.brevo_compteurs_prestataires(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculer_tous_les_scores(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.purger_historique_navigation() TO service_role;
GRANT EXECUTE ON FUNCTION public.calculer_taux_reponse(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.calculer_score_classement(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.calculer_score_classement_for_row(public.prestataires) TO service_role;

-- Visiteurs retirés
REVOKE EXECUTE ON FUNCTION public.admin_stats_zones_categories() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.valider_prestataire_migre(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_stats_zones_categories() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.valider_prestataire_migre(uuid) TO authenticated, service_role;

-- Fonctions déclenchées par la base : aucun appel direct
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_statut_transition() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_note_prestataire() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_est_premium_from_abonnement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.brevo_sync_contact_wake() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_score_avis() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_score_demandes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_score_messages() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_score_prestataires() FROM PUBLIC, anon, authenticated;

-- Noms publics limités
CREATE OR REPLACE VIEW public.profiles_public AS
  SELECT pr.id, pr.prenom,
         CASE WHEN nullif(trim(pr.nom), '') IS NULL THEN NULL ELSE upper(left(trim(pr.nom), 1)) || '.' END AS nom
    FROM public.profiles pr
   WHERE EXISTS (SELECT 1 FROM public.avis a WHERE a.client_id = pr.id AND a.statut = 'valide')
      OR EXISTS (SELECT 1 FROM public.articles_blog b WHERE b.auteur_id = pr.id AND b.est_publie);

ALTER VIEW public.prestataires_public_all SET (security_invoker = on);