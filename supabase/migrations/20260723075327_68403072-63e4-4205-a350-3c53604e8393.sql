DROP POLICY IF EXISTS "Bloquer insert messages en impersonnification" ON public.messages;

CREATE POLICY "Bloquer insert messages en impersonnification"
ON public.messages
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (((auth.jwt() ->> 'is_impersonation')::boolean) IS NOT TRUE);