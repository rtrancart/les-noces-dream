CREATE TYPE public.verification_email AS ENUM ('valid', 'unknown', 'invalid', 'accept_all_unverifiable');

ALTER TABLE public.prestataires ADD COLUMN email_verifie public.verification_email;