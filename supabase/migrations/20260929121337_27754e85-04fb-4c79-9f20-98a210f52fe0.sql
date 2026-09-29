ALTER TYPE public.motif_suspension_enum ADD VALUE IF NOT EXISTS 'refus_migration';
ALTER TABLE public.prestataires ADD COLUMN IF NOT EXISTS archive_le timestamptz;