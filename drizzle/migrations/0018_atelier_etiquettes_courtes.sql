-- Mots de l'intention : tous les mots (y compris courts, hors mots vides courts)
CREATE OR REPLACE FUNCTION public.mots_intention(p text)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public, extensions AS $$
  SELECT mots_significatifs(p) || COALESCE((SELECT array_agg(DISTINCT m) FROM regexp_split_to_table(lower(immutable_unaccent(COALESCE(p,''))), '[^a-z0-9]+') m
    WHERE length(m) BETWEEN 1 AND 2 AND m NOT IN ('de','la','le','et','un','en','du','au','a','l','d','y','on','il','se','ne','ou','je','tu','ce','sa','ma','ta','mi','s','n','j','c','qu','t','m')), '{}')
$$;

-- Mots d'une étiquette : mots significatifs, plus le mot court s'il forme à lui seul toute l'étiquette (ex. « DJ »)
CREATE OR REPLACE FUNCTION public.mots_etiquette(p text)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public, extensions AS $$
  SELECT CASE WHEN lower(immutable_unaccent(btrim(COALESCE(p,'')))) ~ '^[a-z0-9]{1,2}$'
              THEN ARRAY[lower(immutable_unaccent(btrim(p)))]
              ELSE mots_significatifs(p) END
$$;

REVOKE EXECUTE ON FUNCTION public.mots_intention(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mots_intention(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.mots_etiquette(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mots_etiquette(text) TO service_role;

DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.rechercher_prestataires(text, text, text[], extensions.vector, numeric, integer, text)'::regprocedure);
  IF position('mots_significatifs(p_intention_texte)' IN d) = 0 OR position('mots_significatifs(t) && v_mots' IN d) = 0 THEN
    RAISE EXCEPTION 'rechercher_prestataires : motif introuvable';
  END IF;
  d := replace(d, 'mots_significatifs(p_intention_texte)', 'mots_intention(p_intention_texte)');
  d := replace(d, 'mots_significatifs(t) && v_mots', 'mots_etiquette(t) && v_mots');
  EXECUTE d;
END $do$;