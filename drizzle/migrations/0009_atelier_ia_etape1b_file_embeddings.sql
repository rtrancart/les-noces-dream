ALTER TABLE public.prestataires
  ADD COLUMN IF NOT EXISTS sources_hash text,
  ADD COLUMN IF NOT EXISTS tags_ia_hash text,
  ADD COLUMN IF NOT EXISTS embedding_hash text,
  ADD COLUMN IF NOT EXISTS embedding_le timestamptz;

CREATE TABLE IF NOT EXISTS public.ia_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  usage text NOT NULL CHECK (usage IN ('tags_ia','embedding')),
  provider text NOT NULL,
  model text NOT NULL,
  prestataire_id uuid REFERENCES public.prestataires(id) ON DELETE SET NULL,
  tokens_entree integer,
  tokens_sortie integer,
  duree_ms integer,
  statut text NOT NULL DEFAULT 'succes' CHECK (statut IN ('succes','erreur')),
  erreur text
);
REVOKE ALL ON public.ia_logs FROM anon, authenticated;
GRANT SELECT ON public.ia_logs TO authenticated;
GRANT ALL ON public.ia_logs TO service_role;
ALTER TABLE public.ia_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins lecture ia_logs" ON public.ia_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE INDEX IF NOT EXISTS idx_ia_logs_created ON public.ia_logs (created_at DESC);

INSERT INTO public.ia_tarifs (model) VALUES ('mistral-embed') ON CONFLICT (model) DO NOTHING;

CREATE OR REPLACE FUNCTION public.marquer_embedding_a_recalculer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.statut = 'actif' THEN
      INSERT INTO public.embeddings_a_recalculer (prestataire_id, demande_le)
      VALUES (NEW.id, now())
      ON CONFLICT (prestataire_id) DO UPDATE SET demande_le = now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (NEW.description IS DISTINCT FROM OLD.description)
       OR (NEW.description_courte IS DISTINCT FROM OLD.description_courte)
       OR (NEW.tags IS DISTINCT FROM OLD.tags)
       OR (NEW.tags_ia IS DISTINCT FROM OLD.tags_ia)
       OR (NEW.champs_specifiques IS DISTINCT FROM OLD.champs_specifiques)
       OR (NEW.categorie_mere_id IS DISTINCT FROM OLD.categorie_mere_id)
       OR (NEW.categorie_fille_id IS DISTINCT FROM OLD.categorie_fille_id)
       OR (NEW.statut = 'actif' AND OLD.statut IS DISTINCT FROM 'actif' AND NEW.embedding IS NULL) THEN
      INSERT INTO public.embeddings_a_recalculer (prestataire_id, demande_le)
      VALUES (NEW.id, now())
      ON CONFLICT (prestataire_id) DO UPDATE SET demande_le = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prestataires_queue_embedding ON public.prestataires;
CREATE TRIGGER trg_prestataires_queue_embedding
  AFTER INSERT OR UPDATE OF description, description_courte, tags, tags_ia, champs_specifiques, categorie_mere_id, categorie_fille_id, statut
  ON public.prestataires
  FOR EACH ROW
  EXECUTE FUNCTION public.marquer_embedding_a_recalculer();