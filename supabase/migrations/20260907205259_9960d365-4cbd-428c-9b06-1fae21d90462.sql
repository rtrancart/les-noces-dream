CREATE TABLE public.sessions_fiche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  prestataire_id uuid NOT NULL REFERENCES public.prestataires(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duree_seconds integer,
  rebond boolean,
  user_agent text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sessions_fiche_unique UNIQUE (session_id, prestataire_id)
);

GRANT INSERT ON public.sessions_fiche TO anon;
GRANT SELECT, INSERT ON public.sessions_fiche TO authenticated;
GRANT ALL ON public.sessions_fiche TO service_role;

ALTER TABLE public.sessions_fiche ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert sessions"
ON public.sessions_fiche FOR INSERT
WITH CHECK (true);

CREATE POLICY "Owner or admin can view sessions"
ON public.sessions_fiche FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.prestataires p WHERE p.id = prestataire_id AND p.user_id = auth.uid())
);

CREATE POLICY "Admins can update sessions"
ON public.sessions_fiche FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Admins can delete sessions"
ON public.sessions_fiche FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE INDEX idx_sessions_fiche_presta_date
  ON public.sessions_fiche (prestataire_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.purge_sessions_fiche_expirees()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.sessions_fiche WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_sessions_fiche_expirees() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_sessions_fiche_expirees() TO service_role;