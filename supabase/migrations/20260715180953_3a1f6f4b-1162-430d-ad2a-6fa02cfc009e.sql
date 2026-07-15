ALTER TABLE public.abonnements
  ADD COLUMN IF NOT EXISTS carte_brand text,
  ADD COLUMN IF NOT EXISTS carte_last4 text;