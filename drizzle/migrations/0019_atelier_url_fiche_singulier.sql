DO $$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'rechercher_prestataires';
  d := replace(d, 'https://lesnoces.net/prestataires/', 'https://lesnoces.net/prestataire/');
  EXECUTE d;
END $$;