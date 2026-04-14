
CREATE POLICY "Upsert contact can select own email"
ON public.contacts_anonymes
FOR SELECT
USING (email = lower(trim(current_setting('request.jwt.claims', true)::json->>'email')));

CREATE POLICY "Upsert contact can update own email"
ON public.contacts_anonymes
FOR UPDATE
USING (email = lower(trim(current_setting('request.jwt.claims', true)::json->>'email')))
WITH CHECK (email = lower(trim(current_setting('request.jwt.claims', true)::json->>'email')));
