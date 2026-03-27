
-- 1. Add zones_intervention to prestataires
ALTER TABLE public.prestataires 
  ADD COLUMN IF NOT EXISTS zones_intervention text[] DEFAULT '{}'::text[];

-- 2. Add publie_le, meta_title, meta_description to articles_blog
ALTER TABLE public.articles_blog 
  ADD COLUMN IF NOT EXISTS publie_le timestamptz,
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text;

-- 3. Add source and motif_admin to boosts_visibilite
CREATE TYPE public.source_boost AS ENUM ('prestataire', 'admin');

ALTER TABLE public.boosts_visibilite 
  ADD COLUMN IF NOT EXISTS source public.source_boost DEFAULT 'prestataire',
  ADD COLUMN IF NOT EXISTS motif_admin text;
