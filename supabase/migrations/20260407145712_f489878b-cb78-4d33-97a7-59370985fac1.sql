
CREATE POLICY "Anyone can insert contact"
ON public.contacts_anonymes
FOR INSERT
TO public
WITH CHECK (true);
