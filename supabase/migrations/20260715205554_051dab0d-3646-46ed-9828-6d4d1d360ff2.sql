-- 1. Nouvelle valeur d'enum pour distinguer l'expiration après résiliation volontaire
ALTER TYPE public.statut_prestataire ADD VALUE IF NOT EXISTS 'resilie_expire';

-- 2. Colonnes de downgrade programmé sur abonnements
ALTER TABLE public.abonnements
  ADD COLUMN IF NOT EXISTS plan_pending public.plan_abonnement NULL,
  ADD COLUMN IF NOT EXISTS plan_pending_le TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS stripe_schedule_id TEXT NULL;

COMMENT ON COLUMN public.abonnements.plan_pending IS 'Formule cible d''un downgrade programmé (bascule effet fin de période).';
COMMENT ON COLUMN public.abonnements.plan_pending_le IS 'Date à laquelle la bascule vers plan_pending sera exécutée par Stripe.';
COMMENT ON COLUMN public.abonnements.stripe_schedule_id IS 'ID Stripe du subscription_schedule pilotant la bascule programmée.';