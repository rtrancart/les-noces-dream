-- Étape 4 de l'Atelier IA : « Notre style »

-- 1. Profil du mariage
CREATE TABLE public.profils_mariage (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  date_mariage date,
  date_mois integer CHECK (date_mois BETWEEN 1 AND 12),
  date_annee integer CHECK (date_annee BETWEEN 2024 AND 2045),
  lieu_libelle text,
  lieu_type text CHECK (lieu_type IN ('ville','departement','region')),
  lieu_code text,
  departements text[] NOT NULL DEFAULT '{}',
  region text,
  nb_invites text CHECK (nb_invites IN ('moins_30','30_60','60_100','100_150','plus_150')),
  budget_fourchette text CHECK (budget_fourchette IN ('moins_10k','10_20k','20_30k','30_50k','plus_50k','inconnu')),
  types_ceremonie text[] NOT NULL DEFAULT '{}',
  ambiances text[] NOT NULL DEFAULT '{}',
  cadre text,
  couleurs_aimees text[] NOT NULL DEFAULT '{}',
  couleurs_evitees text[] NOT NULL DEFAULT '{}',
  matieres text[] NOT NULL DEFAULT '{}',
  formalite integer CHECK (formalite BETWEEN 1 AND 5),
  description_libre text CHECK (char_length(description_libre) <= 300),
  questionnaire_termine_le timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profils_mariage_ambiances_max CHECK (cardinality(ambiances) <= 3)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profils_mariage TO authenticated;
GRANT ALL ON public.profils_mariage TO service_role;
ALTER TABLE public.profils_mariage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Couple gère son profil mariage" ON public.profils_mariage
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Lieu saisi -> code(s) de département et région, calculés côté base
CREATE OR REPLACE FUNCTION public.profils_mariage_resoudre_lieu()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_dep text;
BEGIN
  NEW.updated_at := now();
  IF NEW.lieu_type IS NULL OR NEW.lieu_code IS NULL THEN
    NEW.departements := '{}'; NEW.region := NULL; RETURN NEW;
  END IF;
  IF NEW.lieu_type = 'ville' THEN
    v_dep := public.departement_depuis_cp(NEW.lieu_code);
    NEW.departements := CASE WHEN v_dep IS NULL THEN '{}' ELSE ARRAY[v_dep] END;
  ELSIF NEW.lieu_type = 'departement' THEN
    SELECT CASE WHEN count(*) > 0 THEN ARRAY[NEW.lieu_code] ELSE '{}' END INTO NEW.departements
      FROM zones_reference WHERE type IN ('departement','dom') AND dept_code = NEW.lieu_code;
  ELSE
    SELECT COALESCE(array_agg(dept_code ORDER BY dept_code), '{}') INTO NEW.departements
      FROM zones_reference WHERE type = 'departement' AND parent_region_zone_value = NEW.lieu_code AND dept_code IS NOT NULL;
  END IF;
  IF NEW.lieu_type = 'region' THEN
    SELECT label INTO NEW.region FROM zones_reference WHERE type = 'region' AND zone_value = NEW.lieu_code LIMIT 1;
  ELSE
    SELECT parent_region_label INTO NEW.region FROM zones_reference
      WHERE type IN ('departement','dom') AND dept_code = NEW.departements[1] LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_profils_mariage_lieu BEFORE INSERT OR UPDATE ON public.profils_mariage
  FOR EACH ROW EXECUTE FUNCTION public.profils_mariage_resoudre_lieu();

-- 2. Bibliothèque de polices
CREATE TABLE public.bibliotheque_polices (
  nom text PRIMARY KEY,
  categorie text NOT NULL CHECK (categorie IN ('serif_elegant','capitales_classiques','script','sans_serif','manuscrit_decontracte')),
  usage text NOT NULL CHECK (usage IN ('titre','texte','les_deux')),
  fichier_ttf text,
  par_defaut boolean NOT NULL DEFAULT false,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bibliotheque_polices TO anon, authenticated;
GRANT ALL ON public.bibliotheque_polices TO service_role;
ALTER TABLE public.bibliotheque_polices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture des polices actives" ON public.bibliotheque_polices FOR SELECT TO anon, authenticated USING (actif = true);
CREATE POLICY "Admins gèrent les polices" ON public.bibliotheque_polices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

INSERT INTO public.bibliotheque_polices (nom, categorie, usage, fichier_ttf, par_defaut) VALUES
  ('Playfair Display','serif_elegant','les_deux',NULL,false),
  ('Cormorant Garamond','serif_elegant','les_deux',NULL,true),
  ('EB Garamond','serif_elegant','les_deux',NULL,false),
  ('Libre Baskerville','serif_elegant','les_deux',NULL,false),
  ('Lora','serif_elegant','les_deux',NULL,false),
  ('Bodoni Moda','serif_elegant','les_deux',NULL,false),
  ('Prata','serif_elegant','les_deux',NULL,false),
  ('DM Serif Display','serif_elegant','titre',NULL,false),
  ('Gilda Display','serif_elegant','les_deux',NULL,false),
  ('Bellefair','serif_elegant','les_deux',NULL,false),
  ('Cinzel','capitales_classiques','titre','cinzel.ttf',true),
  ('Marcellus','capitales_classiques','les_deux','marcellus.ttf',false),
  ('Forum','capitales_classiques','les_deux','forum.ttf',false),
  ('Italiana','capitales_classiques','titre','italiana.ttf',false),
  ('Tenor Sans','capitales_classiques','les_deux','tenorsans.ttf',false),
  ('Great Vibes','script','titre','greatvibes.ttf',true),
  ('Parisienne','script','titre','parisienne.ttf',false),
  ('Pinyon Script','script','titre','pinyonscript.ttf',false),
  ('Allura','script','titre','allura.ttf',false),
  ('Alex Brush','script','titre','alexbrush.ttf',false),
  ('Tangerine','script','titre','tangerine.ttf',false),
  ('Italianno','script','titre','italianno.ttf',false),
  ('Monsieur La Doulaise','script','titre','monsieurladoulaise.ttf',false),
  ('Sacramento','script','titre','sacramento.ttf',false),
  ('Dancing Script','script','titre','dancingscript.ttf',false),
  ('Montserrat','sans_serif','les_deux',NULL,false),
  ('Raleway','sans_serif','les_deux',NULL,false),
  ('Lato','sans_serif','les_deux',NULL,false),
  ('Josefin Sans','sans_serif','les_deux',NULL,false),
  ('Jost','sans_serif','les_deux',NULL,true),
  ('Nunito Sans','sans_serif','les_deux',NULL,false),
  ('Work Sans','sans_serif','les_deux',NULL,false),
  ('Karla','sans_serif','les_deux',NULL,false),
  ('Quicksand','sans_serif','les_deux',NULL,false),
  ('Caveat','manuscrit_decontracte','titre',NULL,true),
  ('Amatic SC','manuscrit_decontracte','titre',NULL,false);

-- 3. Ornements de monogramme (dessins SVG dans le code, tags ici)
CREATE TABLE public.ornements_monogramme (
  id text PRIMARY KEY,
  nom text NOT NULL,
  ambiances text[] NOT NULL DEFAULT '{}',
  ordre integer NOT NULL DEFAULT 0,
  actif boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.ornements_monogramme TO anon, authenticated;
GRANT ALL ON public.ornements_monogramme TO service_role;
ALTER TABLE public.ornements_monogramme ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture des ornements actifs" ON public.ornements_monogramme FOR SELECT TO anon, authenticated USING (actif = true);
INSERT INTO public.ornements_monogramme (id, nom, ambiances, ordre) VALUES
  ('aucun','Aucun','{"Minimaliste","Moderne / contemporain","Sobre / corporate"}',0),
  ('cercle_fin','Cercle fin','{"Minimaliste","Moderne / contemporain","Chic / classique","Bord de mer"}',1),
  ('double_cercle','Double cercle','{"Chic / classique","Vintage / rétro","Romantique"}',2),
  ('losange','Losange','{"Art déco","Moderne / contemporain","Industriel"}',3),
  ('couronne_laurier','Couronne de laurier','{"Champêtre","Romantique","Chic / classique","Méditerranéen"}',4),
  ('branche_feuillage','Branche de feuillage','{"Champêtre","Bohème","Nature / forêt","Tropical / exotique"}',5),
  ('cadre_art_deco','Cadre art déco','{"Art déco","Baroque","Glamour"}',6),
  ('filets_horizontaux','Filets horizontaux','{"Sobre / corporate","Minimaliste","Chic / classique","Vintage / rétro"}',7);

-- 4. Fichiers du couple (photos d'inspiration, logo) : écrits uniquement par la fonction upload-asset
CREATE TABLE public.photos_inspiration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'inspiration' CHECK (type IN ('inspiration','logo')),
  fichier_nom text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  taille_octets bigint NOT NULL CHECK (taille_octets > 0 AND taille_octets <= 10485760),
  format text NOT NULL CHECK (format IN ('image/jpeg','image/png','image/webp','image/svg+xml')),
  largeur integer,
  hauteur integer,
  couleurs_dominantes text[] NOT NULL DEFAULT '{}',
  analyse_ia jsonb,
  analyse_le timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX photos_inspiration_user_idx ON public.photos_inspiration (user_id, created_at DESC);
GRANT SELECT, DELETE ON public.photos_inspiration TO authenticated;
GRANT ALL ON public.photos_inspiration TO service_role;
ALTER TABLE public.photos_inspiration ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Couple lit ses fichiers" ON public.photos_inspiration FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Couple supprime ses fichiers" ON public.photos_inspiration FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 5. Chartes (historique conservé, une seule active par couple)
CREATE TABLE public.chartes_mariage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nom_style text NOT NULL CHECK (char_length(nom_style) BETWEEN 1 AND 60),
  mots_cles text[] NOT NULL DEFAULT '{}',
  palette jsonb NOT NULL,
  police_titre text NOT NULL REFERENCES public.bibliotheque_polices(nom),
  police_texte text NOT NULL REFERENCES public.bibliotheque_polices(nom),
  explication text,
  idees text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'ia' CHECK (source IN ('ia','manuel','photo')),
  monogramme jsonb,
  logo_perso_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chartes_palette_5 CHECK (jsonb_typeof(palette) = 'array' AND jsonb_array_length(palette) = 5),
  CONSTRAINT chartes_logo_chemin CHECK (logo_perso_url IS NULL OR (logo_perso_url !~* '^[a-z]+:' AND split_part(logo_perso_url,'/',1) = user_id::text))
);
COMMENT ON COLUMN public.chartes_mariage.logo_perso_url IS 'Chemin dans le bucket privé maries-assets (affiché par URL signée), jamais une URL publique';
CREATE UNIQUE INDEX chartes_mariage_une_active ON public.chartes_mariage (user_id) WHERE active;
CREATE INDEX chartes_mariage_user_idx ON public.chartes_mariage (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chartes_mariage TO authenticated;
GRANT ALL ON public.chartes_mariage TO service_role;
ALTER TABLE public.chartes_mariage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Couple gère ses chartes" ON public.chartes_mariage FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_chartes_mariage_updated BEFORE UPDATE ON public.chartes_mariage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Stockage : le couple lit et supprime son dossier ; aucun envoi direct
CREATE POLICY "Couple lit son dossier maries-assets" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'maries-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Couple supprime dans son dossier maries-assets" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'maries-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Lecture publique des polices" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'polices');