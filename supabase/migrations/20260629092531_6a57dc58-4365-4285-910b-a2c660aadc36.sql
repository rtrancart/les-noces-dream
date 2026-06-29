
-- 1. Table des familles
CREATE TABLE public.categories_familles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cle text NOT NULL UNIQUE,
  libelle text NOT NULL,
  ordre_affichage integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.categories_familles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories_familles TO authenticated;
GRANT ALL ON public.categories_familles TO service_role;

ALTER TABLE public.categories_familles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Familles visibles par tous"
  ON public.categories_familles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins peuvent gerer les familles"
  ON public.categories_familles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role)
           OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE TRIGGER trg_categories_familles_updated_at
  BEFORE UPDATE ON public.categories_familles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. FK famille_id sur categories
ALTER TABLE public.categories
  ADD COLUMN famille_id uuid REFERENCES public.categories_familles(id) ON DELETE SET NULL;

CREATE INDEX idx_categories_famille_id ON public.categories(famille_id);

-- 3. Seed des 6 familles
INSERT INTO public.categories_familles (cle, libelle, ordre_affichage) VALUES
  ('lieux-hebergement',          'Lieux & Hébergement',              1),
  ('reception-gastronomie',      'Réception & Gastronomie',          2),
  ('image-musique-animation',    'Image, Musique & Animation',       3),
  ('style-decor-organisation',   'Style, Décor & Organisation',      4),
  ('transport-materiel',         'Transport & Matériel',             5),
  ('ceremonie-papeterie-services','Cérémonie, Papeterie & Services', 6);

-- 4. Rattachement des catégories mères existantes
UPDATE public.categories c SET famille_id = f.id
FROM public.categories_familles f
WHERE c.parent_id IS NULL
  AND (
    (f.cle = 'lieux-hebergement'           AND c.slug IN ('lieux-de-reception','hebergements')) OR
    (f.cle = 'reception-gastronomie'       AND c.slug IN ('traiteur-gastronomie','barmen','caviste-domaine-viticole')) OR
    (f.cle = 'image-musique-animation'     AND c.slug IN ('photographe-videaste','musicien-dj','animation','artificier')) OR
    (f.cle = 'style-decor-organisation'    AND c.slug IN ('wedding-planner','decoration','fleuriste','vetements-mariage','bijoux-de-mariage','beaute')) OR
    (f.cle = 'transport-materiel'          AND c.slug IN ('transport-vehicules','location-de-materiel')) OR
    (f.cle = 'ceremonie-papeterie-services' AND c.slug IN ('officiant-de-ceremonie','faire-parts','agents-de-securite','service-de-menage','nounous-et-animatrice-enfants'))
  );
