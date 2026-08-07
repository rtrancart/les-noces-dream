REVOKE EXECUTE ON FUNCTION public.brevo_sync_prestataire_wake(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.brevo_prestataire_sync_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.brevo_abonnement_sync_trigger() FROM PUBLIC, anon, authenticated;