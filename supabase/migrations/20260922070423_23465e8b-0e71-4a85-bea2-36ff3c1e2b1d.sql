ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS seo_intro text,
  ADD COLUMN IF NOT EXISTS seo_body text,
  ADD COLUMN IF NOT EXISTS faq jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS nom_singulier text,
  ADD COLUMN IF NOT EXISTS genre text;

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_genre_check;

ALTER TABLE public.categories
  ADD CONSTRAINT categories_genre_check
  CHECK (genre IS NULL OR genre IN ('masculin', 'feminin'));

CREATE OR REPLACE VIEW public.categories_compteurs
WITH (security_invoker = true) AS
SELECT c.id,
       c.slug,
       c.parent_id,
       (
         SELECT count(*)::int
         FROM public.prestataires p
         WHERE p.statut = 'actif'::statut_prestataire
           AND (
             CASE WHEN c.parent_id IS NULL
                  THEN p.categorie_mere_id = c.id
                  ELSE p.categorie_fille_id = c.id
             END
           )
       ) AS nb_prestataires_actifs
FROM public.categories c
WHERE c.est_active;

GRANT SELECT ON public.categories_compteurs TO anon, authenticated;
GRANT ALL ON public.categories_compteurs TO service_role;