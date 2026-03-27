-- Add photo_url column to categories for the background photo of category cards
ALTER TABLE public.categories ADD COLUMN photo_url text;

-- Create storage bucket for category assets (photos + pictos)
INSERT INTO storage.buckets (id, name, public) VALUES ('categories-assets', 'categories-assets', true);

-- RLS: anyone can view category assets
CREATE POLICY "Public can view category assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'categories-assets');

-- RLS: admins can manage category assets
CREATE POLICY "Admins can manage category assets"
ON storage.objects FOR ALL
USING (
  bucket_id = 'categories-assets'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
)
WITH CHECK (
  bucket_id = 'categories-assets'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
);