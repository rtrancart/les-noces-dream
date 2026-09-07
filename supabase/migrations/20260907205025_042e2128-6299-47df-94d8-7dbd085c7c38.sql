CREATE OR REPLACE FUNCTION public.can_write_prestataire_video(p_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      lower(p_path) LIKE '%.mp4'
      OR (split_part(p_path, '/', 2) = 'thumbs' AND (lower(p_path) LIKE '%.jpg' OR lower(p_path) LIKE '%.jpeg'))
    )
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.prestataires p
        WHERE p.user_id = auth.uid()
          AND p.id::text = split_part(p_path, '/', 1)
      )
    )
$$;

REVOKE ALL ON FUNCTION public.can_write_prestataire_video(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_prestataire_video(text) TO authenticated;

DROP POLICY IF EXISTS "Public can view prestataires videos" ON storage.objects;
CREATE POLICY "Public can view prestataires videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'prestataires-videos');

DROP POLICY IF EXISTS "Owner or admin can upload prestataires videos" ON storage.objects;
CREATE POLICY "Owner or admin can upload prestataires videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'prestataires-videos' AND public.can_write_prestataire_video(name));

DROP POLICY IF EXISTS "Owner or admin can update prestataires videos" ON storage.objects;
CREATE POLICY "Owner or admin can update prestataires videos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'prestataires-videos' AND public.can_write_prestataire_video(name))
WITH CHECK (bucket_id = 'prestataires-videos' AND public.can_write_prestataire_video(name));

DROP POLICY IF EXISTS "Owner or admin can delete prestataires videos" ON storage.objects;
CREATE POLICY "Owner or admin can delete prestataires videos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'prestataires-videos' AND public.can_write_prestataire_video(name));