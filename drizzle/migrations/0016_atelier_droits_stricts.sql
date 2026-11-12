REVOKE ALL ON public.conversations_atelier, public.messages_atelier, public.retours_atelier FROM anon, authenticated;
GRANT SELECT, DELETE ON public.conversations_atelier TO authenticated;
GRANT INSERT (titre), UPDATE (titre) ON public.conversations_atelier TO authenticated;
GRANT SELECT, DELETE ON public.messages_atelier TO authenticated;
GRANT SELECT, DELETE ON public.retours_atelier TO authenticated;
GRANT INSERT (message_id, note, commentaire) ON public.retours_atelier TO authenticated;
GRANT ALL ON public.conversations_atelier, public.messages_atelier, public.retours_atelier TO service_role;