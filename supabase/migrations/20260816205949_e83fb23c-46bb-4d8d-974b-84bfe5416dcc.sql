CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = extensions, public
AS $$ SELECT lower(extensions.unaccent('extensions.unaccent', $1)) $$;

ALTER TABLE public.prestataires
  ADD COLUMN IF NOT EXISTS nom_commercial_norm text
  GENERATED ALWAYS AS (public.immutable_unaccent(nom_commercial)) STORED;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_prestataires_nom_commercial_norm
  ON public.prestataires USING gin (nom_commercial_norm extensions.gin_trgm_ops);