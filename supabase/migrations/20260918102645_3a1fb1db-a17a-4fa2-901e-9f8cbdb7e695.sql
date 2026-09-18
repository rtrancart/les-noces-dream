REVOKE EXECUTE ON FUNCTION public.monitoring_symptomes() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.monitoring_alerte_verrou(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.monitoring_alerte_liberer(text) FROM anon, authenticated;