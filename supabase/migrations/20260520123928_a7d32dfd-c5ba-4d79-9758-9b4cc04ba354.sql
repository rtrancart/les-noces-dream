ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS envoye_par_email boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Bloquer insert messages en impersonnification" ON public.messages;
CREATE POLICY "Bloquer insert messages en impersonnification"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK ((auth.jwt() ->> 'is_impersonation')::boolean IS NOT TRUE);