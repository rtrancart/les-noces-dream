DROP POLICY IF EXISTS "Authenticated can insert avis" ON public.avis;

CREATE POLICY "Clients can submit reviews (pending moderation)"
ON public.avis
FOR INSERT
TO authenticated
WITH CHECK (
  client_id = auth.uid()
  AND statut = 'en_attente'
  AND NOT EXISTS (
    SELECT 1 FROM public.prestataires p
    WHERE p.id = avis.prestataire_id
      AND p.user_id = auth.uid()
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.avis a
    WHERE a.client_id = auth.uid()
      AND a.prestataire_id = avis.prestataire_id
  )
);