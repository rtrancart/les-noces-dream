CREATE UNIQUE INDEX IF NOT EXISTS prestataires_email_contact_lower_unique
  ON public.prestataires (lower(email_contact))
  WHERE email_contact IS NOT NULL;