ALTER TABLE public.prerender_queue
  ADD COLUMN IF NOT EXISTS priorite smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS force_rendu boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_prerender_queue_a_traiter_prio
  ON public.prerender_queue (priorite DESC, updated_at ASC) WHERE statut = 'a_traiter';
CREATE INDEX IF NOT EXISTS idx_prerender_queue_rendu_le
  ON public.prerender_queue (rendu_le) WHERE statut = 'a_jour';

CREATE OR REPLACE FUNCTION public.prerender_priorite_type(p_type text)
RETURNS smallint LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_type IN ('statique','region','categorie','categorie_fille') THEN 2
    WHEN p_type IN ('article_blog','page_contenu') THEN 1
    ELSE 0 END::smallint
$$;

CREATE OR REPLACE FUNCTION public.prerender_planifier_rafraichissement(p_limit integer, p_age interval)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  WITH cibles AS (
    SELECT id FROM public.prerender_queue
    WHERE statut = 'a_jour' AND storage_path IS NOT NULL
      AND (rendu_le IS NULL OR rendu_le < now() - p_age)
    ORDER BY public.prerender_priorite_type(page_type) DESC, rendu_le ASC NULLS FIRST
    LIMIT GREATEST(p_limit, 0)
  )
  UPDATE public.prerender_queue q
     SET statut = 'a_traiter', force_rendu = true, tentatives = 0,
         priorite = public.prerender_priorite_type(q.page_type), updated_at = now()
    FROM cibles WHERE q.id = cibles.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.prerender_planifier_rafraichissement(integer, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prerender_planifier_rafraichissement(integer, interval) TO service_role;