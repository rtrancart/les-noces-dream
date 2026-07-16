
ALTER VIEW public.prestataires_public_all SET (security_invoker = true);
-- Re-affirme la fermeture après ALTER (les grants ne changent pas mais on reste explicite).
REVOKE ALL ON public.prestataires_public_all FROM PUBLIC;
REVOKE ALL ON public.prestataires_public_all FROM anon, authenticated;
