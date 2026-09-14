-- Fonctions de calcul de bruit : aucune donnée sensible, exécution en invoker
ALTER FUNCTION public.score_classement_bruite(uuid, numeric) SECURITY INVOKER;

-- RPC dernière connexion : exécution en invoker, la politique RLS "Owner can update own prestataire" s'applique
ALTER FUNCTION public.marquer_derniere_connexion(uuid) SECURITY INVOKER;

-- Révocation des droits publics sur les fonctions internes (les triggers et le cron tournent avec les privilèges du propriétaire)
REVOKE ALL ON FUNCTION public.calculer_score_classement(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculer_score_classement_for_row(public.prestataires) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalculer_tous_les_scores(int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_score_avis() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_score_prestataires() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_score_messages() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_score_demandes() FROM PUBLIC;

-- Grants ciblés pour les fonctions appelées par les clients ou la vue publique
GRANT EXECUTE ON FUNCTION public.score_classement_bruite(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.score_classement_bruite(uuid, numeric) TO anon;
GRANT EXECUTE ON FUNCTION public.marquer_derniere_connexion(uuid) TO authenticated;