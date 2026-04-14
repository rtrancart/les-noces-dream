
-- 1. Allow prestataire owner to UPDATE demandes_devis (e.g. change statut)
CREATE POLICY "Owner prestataire can update demande"
ON public.demandes_devis FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM prestataires
  WHERE prestataires.id = demandes_devis.prestataire_id
    AND prestataires.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM prestataires
  WHERE prestataires.id = demandes_devis.prestataire_id
    AND prestataires.user_id = auth.uid()
));

-- 2. Allow participants to UPDATE messages (for marking lu_le)
CREATE POLICY "Participants can update messages"
ON public.messages FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM demandes_devis dd
  WHERE dd.id = messages.demande_id
    AND (dd.profile_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM prestataires p
        WHERE p.id = dd.prestataire_id AND p.user_id = auth.uid()
      ))
));

-- 3. Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
