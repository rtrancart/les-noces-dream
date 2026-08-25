CREATE TABLE public.prerender_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url_path text NOT NULL,
  page_type text NOT NULL CHECK (page_type IN ('prestataire','categorie','categorie_fille','region','article_blog','page_contenu','statique')),
  source_id uuid,
  signature_visible text,
  signature_rendue text,
  statut text NOT NULL DEFAULT 'a_traiter' CHECK (statut IN ('a_traiter','a_jour','abandonne')),
  tentatives integer NOT NULL DEFAULT 0,
  dernier_motif text,
  dernier_status integer,
  storage_path text,
  rendu_le timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX prerender_queue_url_key ON public.prerender_queue (url_path);
CREATE INDEX prerender_queue_a_traiter_idx ON public.prerender_queue (updated_at) WHERE statut = 'a_traiter';
CREATE INDEX prerender_queue_page_type_idx ON public.prerender_queue (page_type);

GRANT SELECT ON public.prerender_queue TO authenticated;
GRANT ALL ON public.prerender_queue TO service_role;

ALTER TABLE public.prerender_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins peuvent lire la file de pre-rendu"
ON public.prerender_queue FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE TRIGGER update_prerender_queue_updated_at
BEFORE UPDATE ON public.prerender_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Lecture publique des snapshots de pre-rendu"
ON storage.objects FOR SELECT
USING (bucket_id = 'prerender-snapshots');
