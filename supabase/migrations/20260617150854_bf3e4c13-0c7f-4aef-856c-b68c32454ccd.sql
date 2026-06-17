
-- Helper: only owner of the prestataire (folder = prestataire_id) or admin/super_admin can write
CREATE OR REPLACE FUNCTION public.can_write_prestataire_photo(p_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.prestataires p
      WHERE p.user_id = auth.uid()
        AND p.id::text = split_part(p_path, '/', 1)
    )
$$;

REVOKE ALL ON FUNCTION public.can_write_prestataire_photo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_prestataire_photo(text) TO authenticated;

-- Replace permissive INSERT policy + add UPDATE/DELETE policies on storage.objects for the bucket
DROP POLICY IF EXISTS "Authenticated can upload prestataires photos" ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin can upload prestataires photos" ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin can update prestataires photos" ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin can delete prestataires photos" ON storage.objects;

CREATE POLICY "Owner or admin can upload prestataires photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'prestataires-photos'
  AND public.can_write_prestataire_photo(name)
);

CREATE POLICY "Owner or admin can update prestataires photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'prestataires-photos'
  AND public.can_write_prestataire_photo(name)
)
WITH CHECK (
  bucket_id = 'prestataires-photos'
  AND public.can_write_prestataire_photo(name)
);

CREATE POLICY "Owner or admin can delete prestataires photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'prestataires-photos'
  AND public.can_write_prestataire_photo(name)
);
