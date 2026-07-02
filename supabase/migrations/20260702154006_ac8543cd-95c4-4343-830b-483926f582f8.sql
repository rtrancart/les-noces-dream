
-- Ensure pgcrypto is available for digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Server-side authoritative hash: overrides any client-provided value.
CREATE OR REPLACE FUNCTION public.chartes_versions_enforce_hash()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NEW.contenu_html IS NULL THEN
    RAISE EXCEPTION 'contenu_html ne peut être NULL sur chartes_versions';
  END IF;

  -- Recompute unconditionally; the client value (if any) is ignored.
  NEW.contenu_hash := encode(extensions.digest(NEW.contenu_html, 'sha256'), 'hex');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chartes_versions_enforce_hash_ins ON public.chartes_versions;
DROP TRIGGER IF EXISTS chartes_versions_enforce_hash_upd ON public.chartes_versions;

CREATE TRIGGER chartes_versions_enforce_hash_ins
  BEFORE INSERT ON public.chartes_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.chartes_versions_enforce_hash();

CREATE TRIGGER chartes_versions_enforce_hash_upd
  BEFORE UPDATE OF contenu_html, contenu_hash ON public.chartes_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.chartes_versions_enforce_hash();

-- Backfill: re-align any existing rows whose stored hash drifted from the actual content.
UPDATE public.chartes_versions
SET contenu_hash = encode(extensions.digest(contenu_html, 'sha256'), 'hex')
WHERE contenu_hash IS DISTINCT FROM encode(extensions.digest(contenu_html, 'sha256'), 'hex');
