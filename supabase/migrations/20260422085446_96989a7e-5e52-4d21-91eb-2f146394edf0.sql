-- Ajout des nouveaux champs à articles_blog
ALTER TABLE public.articles_blog
  ADD COLUMN IF NOT EXISTS auteur text,
  ADD COLUMN IF NOT EXISTS temps_lecture int,
  ADD COLUMN IF NOT EXISTS legende_image text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS balise_canonique text,
  ADD COLUMN IF NOT EXISTS faq jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS noindex boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inclure_sitemap boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS prestataires_lies uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS articles_lies uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS categorie_liee_slug text;

-- Création du bucket public pour les images d'articles
INSERT INTO storage.buckets (id, name, public)
VALUES ('articles-blog', 'articles-blog', true)
ON CONFLICT (id) DO NOTHING;

-- Politiques RLS sur le bucket
DROP POLICY IF EXISTS "Public can read articles-blog" ON storage.objects;
CREATE POLICY "Public can read articles-blog"
ON storage.objects FOR SELECT
USING (bucket_id = 'articles-blog');

DROP POLICY IF EXISTS "Admins can upload articles-blog" ON storage.objects;
CREATE POLICY "Admins can upload articles-blog"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'articles-blog'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
);

DROP POLICY IF EXISTS "Admins can update articles-blog" ON storage.objects;
CREATE POLICY "Admins can update articles-blog"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'articles-blog'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
);

DROP POLICY IF EXISTS "Admins can delete articles-blog" ON storage.objects;
CREATE POLICY "Admins can delete articles-blog"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'articles-blog'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
);