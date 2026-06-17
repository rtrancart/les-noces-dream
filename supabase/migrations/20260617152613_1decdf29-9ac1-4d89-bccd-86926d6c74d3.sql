ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can subscribe to conversation channel" ON realtime.messages;
DROP POLICY IF EXISTS "User can subscribe to own sidebar channel" ON realtime.messages;

CREATE POLICY "Participants can subscribe to conversation channel"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (
      realtime.topic() LIKE 'messages-%'
      AND EXISTS (
        SELECT 1 FROM public.demandes_devis dd
        WHERE dd.id::text = substring(realtime.topic() FROM 'messages-(.*)')
          AND (
            dd.profile_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.prestataires p
              WHERE p.id = dd.prestataire_id AND p.user_id = auth.uid()
            )
          )
      )
    )
  );

CREATE POLICY "User can subscribe to own sidebar channel"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.topic() = 'sidebar-unread-' || auth.uid()::text
  );