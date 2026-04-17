DROP POLICY IF EXISTS "Public can read active email textes" ON public.email_textes;

CREATE POLICY "Admins can view email textes"
ON public.email_textes
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));