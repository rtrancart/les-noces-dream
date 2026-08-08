CREATE TABLE public.oppositions_marketing (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  motif text NOT NULL CHECK (motif IN ('unsubscribe','spam','blocked','hard_bounce','manuel')),
  source text NOT NULL DEFAULT 'brevo_webhook',
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_oppositions_marketing_email ON public.oppositions_marketing (email);

GRANT SELECT ON public.oppositions_marketing TO authenticated;
GRANT ALL ON public.oppositions_marketing TO service_role;

ALTER TABLE public.oppositions_marketing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins lisent les oppositions"
ON public.oppositions_marketing FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Service role gere les oppositions"
ON public.oppositions_marketing FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.oppositions_marketing_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Les oppositions marketing sont en ajout seul (ni modification, ni suppression).';
END;
$$;

CREATE TRIGGER trg_oppositions_marketing_append_only
BEFORE UPDATE OR DELETE ON public.oppositions_marketing
FOR EACH ROW EXECUTE FUNCTION public.oppositions_marketing_append_only();

DROP FUNCTION IF EXISTS public.brevo_compteurs_prestataires(integer, integer);

CREATE FUNCTION public.brevo_compteurs_prestataires(p_limit integer DEFAULT 500, p_offset integer DEFAULT 0)
RETURNS TABLE(prestataire_id uuid, email text, nb_vues integer, nb_demandes integer, nb_favoris integer, taux_reponse numeric, note_moyenne real, oppose boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH page AS (
    SELECT p.id, lower(trim(p.email_contact)) AS email, p.taux_reponse, p.note_moyenne
    FROM public.prestataires p
    WHERE p.email_contact IS NOT NULL AND trim(p.email_contact) <> ''
    ORDER BY p.id
    LIMIT p_limit OFFSET p_offset
  )
  SELECT
    page.id,
    page.email,
    COALESCE((SELECT count(*) FROM public.evenements_prestataire e
               WHERE e.prestataire_id = page.id AND e.type = 'vue_profil'), 0)::int,
    COALESCE((SELECT count(*) FROM public.demandes_devis d
               WHERE d.prestataire_id = page.id), 0)::int,
    COALESCE((SELECT count(*) FROM public.favoris f
               WHERE f.prestataire_id = page.id), 0)::int,
    page.taux_reponse,
    round(page.note_moyenne::numeric, 1)::real,
    EXISTS (SELECT 1 FROM public.oppositions_marketing o WHERE o.email = page.email)
  FROM page
  ORDER BY page.id;
$$;