CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

ALTER TABLE public.prestataires
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(1024),
  ADD COLUMN IF NOT EXISTS tags_ia text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.prestataires.embedding IS 'Vecteur sémantique 1024D généré pour la recherche IA (Atelier). Jamais exposé au public.';
COMMENT ON COLUMN public.prestataires.tags_ia IS 'Tags de style générés par IA. Modifiables par admin. Jamais exposés au public.';

CREATE INDEX IF NOT EXISTS idx_prestataires_embedding_hnsw
  ON public.prestataires
  USING hnsw (embedding extensions.vector_cosine_ops);

CREATE TABLE IF NOT EXISTS public.embeddings_a_recalculer (
  prestataire_id uuid PRIMARY KEY REFERENCES public.prestataires(id) ON DELETE CASCADE,
  demande_le timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.embeddings_a_recalculer IS 'File d''attente pour la régénération asynchrone des vecteurs sémantiques.';

REVOKE ALL ON public.embeddings_a_recalculer FROM anon, authenticated;
GRANT ALL ON public.embeddings_a_recalculer TO service_role;
ALTER TABLE public.embeddings_a_recalculer ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.marquer_embedding_a_recalculer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (
    TG_OP = 'UPDATE' AND (
      OLD.description IS DISTINCT FROM NEW.description
      OR OLD.tags IS DISTINCT FROM NEW.tags
      OR OLD.tags_ia IS DISTINCT FROM NEW.tags_ia
      OR OLD.champs_specifiques IS DISTINCT FROM NEW.champs_specifiques
    )
  ) THEN
    INSERT INTO public.embeddings_a_recalculer (prestataire_id, demande_le)
    VALUES (NEW.id, now())
    ON CONFLICT (prestataire_id)
    DO UPDATE SET demande_le = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prestataires_queue_embedding ON public.prestataires;
CREATE TRIGGER trg_prestataires_queue_embedding
  AFTER INSERT OR UPDATE OF description, tags, tags_ia, champs_specifiques
  ON public.prestataires
  FOR EACH ROW
  EXECUTE FUNCTION public.marquer_embedding_a_recalculer();

CREATE OR REPLACE FUNCTION public.marquer_embedding_avis_a_recalculer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.statut = 'valide' AND OLD.prestataire_id IS NOT NULL THEN
      INSERT INTO public.embeddings_a_recalculer (prestataire_id, demande_le)
      VALUES (OLD.prestataire_id, now())
      ON CONFLICT (prestataire_id)
      DO UPDATE SET demande_le = now();
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.statut = 'valide' AND NEW.prestataire_id IS NOT NULL THEN
      INSERT INTO public.embeddings_a_recalculer (prestataire_id, demande_le)
      VALUES (NEW.prestataire_id, now())
      ON CONFLICT (prestataire_id)
      DO UPDATE SET demande_le = now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.statut = 'valide' AND NEW.statut IS DISTINCT FROM 'valide' THEN
      IF OLD.prestataire_id IS NOT NULL THEN
        INSERT INTO public.embeddings_a_recalculer (prestataire_id, demande_le)
        VALUES (OLD.prestataire_id, now())
        ON CONFLICT (prestataire_id)
        DO UPDATE SET demande_le = now();
      END IF;
    ELSIF OLD.statut IS DISTINCT FROM 'valide' AND NEW.statut = 'valide' THEN
      IF NEW.prestataire_id IS NOT NULL THEN
        INSERT INTO public.embeddings_a_recalculer (prestataire_id, demande_le)
        VALUES (NEW.prestataire_id, now())
        ON CONFLICT (prestataire_id)
        DO UPDATE SET demande_le = now();
      END IF;
    ELSIF NEW.statut = 'valide' AND OLD.commentaire IS DISTINCT FROM NEW.commentaire THEN
      IF NEW.prestataire_id IS NOT NULL THEN
        INSERT INTO public.embeddings_a_recalculer (prestataire_id, demande_le)
        VALUES (NEW.prestataire_id, now())
        ON CONFLICT (prestataire_id)
        DO UPDATE SET demande_le = now();
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avis_queue_embedding ON public.avis;
CREATE TRIGGER trg_avis_queue_embedding
  AFTER INSERT OR DELETE OR UPDATE OF statut, commentaire, prestataire_id
  ON public.avis
  FOR EACH ROW
  EXECUTE FUNCTION public.marquer_embedding_avis_a_recalculer();

WITH mapping(old_val, new_val) AS (
  VALUES
    ('Jazz', 'Jazz / swing'),
    ('Électro / club', 'Électro')
),
elements AS (
  SELECT 
    p.id,
    COALESCE(m.new_val, elem.val) AS style_final
  FROM public.prestataires p,
  LATERAL jsonb_array_elements_text(p.champs_specifiques->'styles_musicaux') AS elem(val)
  LEFT JOIN mapping m ON m.old_val = elem.val
  WHERE jsonb_typeof(p.champs_specifiques->'styles_musicaux') = 'array'
),
reconstitue AS (
  SELECT 
    id, 
    jsonb_agg(DISTINCT to_jsonb(style_final)) AS nouveaux_styles
  FROM elements
  GROUP BY id
)
UPDATE public.prestataires p
SET champs_specifiques = p.champs_specifiques || jsonb_build_object('styles_musicaux', r.nouveaux_styles)
FROM reconstitue r
WHERE p.id = r.id;

UPDATE public.champs_categories
SET options_liste = ARRAY[
  'House','Disco / funk','Années 80-90','Variété / pop','Rock','Électro',
  'Jazz / swing','Rétro','Classique','Musiques du monde','Latino','Généraliste'
],
updated_at = now()
WHERE cle = 'styles_musicaux'
  AND categorie_id = '37c46d6a-24ed-49d3-b10b-8c81eab6ef49'::uuid;

INSERT INTO public.champs_categories (
  categorie_id, cle, label, type_champ, options_liste, groupe,
  obligatoire, visible_public, filtrable, ordre_affichage
)
SELECT
  'ac98ce20-37f2-4210-8223-92e341067fa3'::uuid, 'type_de_lieu', 'Type de lieu', 'multi_choix',
  ARRAY['Château','Domaine','Grange / ferme','Bord de mer','Montagne','Urbain','Salle de réception'],
  'Lieu de réception', false, true, true, 220
WHERE NOT EXISTS (
  SELECT 1 FROM public.champs_categories 
  WHERE categorie_id = 'ac98ce20-37f2-4210-8223-92e341067fa3'::uuid AND cle = 'type_de_lieu'
);

INSERT INTO public.champs_categories (
  categorie_id, cle, label, type_champ, options_liste, groupe,
  obligatoire, visible_public, filtrable, ordre_affichage
)
SELECT
  '8f9d577e-6654-4d78-bf9e-da79701ab03c'::uuid, 'approche', 'Approche', 'multi_choix',
  ARRAY['Reportage','Posé','Fine art','Argentique','Éditorial'],
  'Photo / Vidéo', false, true, true, 130
WHERE NOT EXISTS (
  SELECT 1 FROM public.champs_categories 
  WHERE categorie_id = '8f9d577e-6654-4d78-bf9e-da79701ab03c'::uuid AND cle = 'approche'
);