
DROP POLICY "Admins can manage prestataires" ON public.prestataires;

CREATE POLICY "Admins can manage prestataires" ON public.prestataires
FOR ALL TO public
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
