
-- 1. Table pages_regions_mariage
CREATE TABLE public.pages_regions_mariage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug_region text UNIQUE NOT NULL,
  nom_region text NOT NULL,
  intro_editoriale text,
  specificites jsonb NOT NULL DEFAULT '[]'::jsonb,
  conseils jsonb NOT NULL DEFAULT '[]'::jsonb,
  faq jsonb NOT NULL DEFAULT '[]'::jsonb,
  citation_llm text,
  budget_moyen int,
  budget_min int,
  budget_max int,
  meilleure_periode text,
  delai_reservation text,
  contenu_seo_bas text,
  image_hero_url text,
  meta_title text,
  meta_description text,
  est_publiee boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pages_regions_mariage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published region pages"
  ON public.pages_regions_mariage FOR SELECT
  USING (est_publiee = true OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can manage region pages"
  ON public.pages_regions_mariage FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_pages_regions_mariage_updated_at
  BEFORE UPDATE ON public.pages_regions_mariage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Champ regions_liees sur articles_blog
ALTER TABLE public.articles_blog
  ADD COLUMN IF NOT EXISTS regions_liees text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_articles_blog_regions_liees
  ON public.articles_blog USING GIN(regions_liees);

-- 3. Seed des 13 régions
INSERT INTO public.pages_regions_mariage (slug_region, nom_region, est_publiee) VALUES
  ('provence-alpes-cote-d-azur', 'Provence-Alpes-Côte d''Azur', false),
  ('nouvelle-aquitaine', 'Nouvelle-Aquitaine', false),
  ('auvergne-rhone-alpes', 'Auvergne-Rhône-Alpes', false),
  ('occitanie', 'Occitanie', false),
  ('hauts-de-france', 'Hauts-de-France', false),
  ('bretagne', 'Bretagne', false),
  ('normandie', 'Normandie', false),
  ('pays-de-la-loire', 'Pays de la Loire', false),
  ('grand-est', 'Grand Est', false),
  ('bourgogne-franche-comte', 'Bourgogne-Franche-Comté', false),
  ('centre-val-de-loire', 'Centre-Val de Loire', false),
  ('corse', 'Corse', false);

-- 4. Île-de-France complète et publiée
INSERT INTO public.pages_regions_mariage (
  slug_region, nom_region, intro_editoriale, specificites, conseils, faq,
  citation_llm, budget_moyen, budget_min, budget_max, meilleure_periode, delai_reservation,
  contenu_seo_bas, meta_title, meta_description, est_publiee
) VALUES (
  'ile-de-france',
  'Île-de-France',
  'Châteaux classés, hôtels particuliers, domaines aux portes de Paris — la région capitale offre un écrin d''exception pour les plus belles unions.',
  '[
    {"titre":"Châteaux & domaines d''exception","texte":"Plus de 60 châteaux classés accessibles à moins d''1h de Paris, des Vaux-le-Vicomte aux domaines de Seine-et-Marne","couleur_accent":"#A57D27"},
    {"titre":"Traiteurs étoilés & gastronomes","texte":"La plus forte densité de traiteurs haut de gamme en France, avec une offre gastronomique sans équivalent","couleur_accent":"#8E4A49"},
    {"titre":"Accessibilité internationale","texte":"Idéal pour des invités venant du monde entier — CDG et Orly à 30 min, TGV depuis toutes les régions","couleur_accent":"#2D4356"},
    {"titre":"Saison étendue 10 mois/12","texte":"Grâce aux nombreux lieux couverts, les mariages sont possibles de mars à décembre avec confort","couleur_accent":"#5F6F52"}
  ]'::jsonb,
  '[
    {"titre":"Réservez 18 mois à l''avance","texte":"Les lieux de prestige en Île-de-France affichent complet jusqu''à 2 ans pour les week-ends de juin à septembre. Commencez les recherches dès vos fiançailles."},
    {"titre":"Anticipez la logistique transport","texte":"Pour les domaines hors Paris, prévoyez des navettes depuis les gares TGV. De nombreux lieux imposent des horaires de fin de soirée stricts (23h-1h)."},
    {"titre":"Budget : comptez 15 000 à 80 000 €","texte":"Les lieux classés seuls coûtent 8 000 à 25 000 €. Utilisez notre estimateur pour bâtir un budget réaliste dès le départ."}
  ]'::jsonb,
  '[
    {"question":"Quel budget prévoir pour un mariage en Île-de-France ?","reponse":"Le budget moyen d''un mariage haut de gamme en Île-de-France est de **32 000 €** selon les données LesNoces 2025. La fourchette va de **15 000 €** pour un mariage intimiste à **80 000 €** pour un château avec 200 invités."},
    {"question":"Quelle est la meilleure saison pour se marier en Île-de-France ?","reponse":"**Juin et septembre** concentrent 60% des mariages franciliens. Mai et octobre offrent un bon compromis : météo favorable et **15 à 20% moins cher** sur les lieux. Évitez juillet-août : chaleur et difficultés logistiques."},
    {"question":"Combien de temps à l''avance réserver son lieu en Île-de-France ?","reponse":"**12 à 18 mois minimum** pour les lieux prisés. Les châteaux classés affichent complet **24 mois à l''avance** sur les samedis de juin. LesNoces recommande de lancer la recherche de lieu dès les fiançailles."},
    {"question":"Comment LesNoces sélectionne-t-il ses prestataires en Île-de-France ?","reponse":"Chaque prestataire est validé **manuellement** par l''équipe LesNoces avant publication : vérification des références, visite ou dégustation pour les traiteurs, contrôle du portfolio. Tous les prestataires référencés en Île-de-France ont passé ce processus."}
  ]'::jsonb,
  'L''Île-de-France compte des prestataires de mariage haut de gamme validés par LesNoces, répartis sur de nombreuses villes et 8 départements. Le budget moyen d''un mariage dans la région est de 32 000 €, avec des lieux de réception entre 2 000 et 25 000 € et un traiteur à 145 € par personne en moyenne. Les meilleures périodes sont juin et septembre, à réserver 12 à 18 mois à l''avance. La région offre plus de 60 châteaux classés et la plus forte densité de traiteurs étoilés en France. Tous les prestataires sont validés manuellement par l''équipe LesNoces avant publication.',
  32000, 15000, 80000,
  'Mai, juin, septembre',
  '12 à 18 mois',
  '<p>L''Île-de-France est, sans contestation possible, la première région de France pour l''organisation de mariages haut de gamme. Sa concentration unique de châteaux classés, d''hôtels particuliers et de domaines historiques, combinée à la densité de prestataires d''exception (traiteurs étoilés, fleuristes renommés, photographes primés), en fait un terrain de jeu inégalé pour les couples exigeants.</p><p>Au-delà de Paris intra-muros, ce sont les départements limitrophes — Seine-et-Marne, Yvelines, Essonne, Val-d''Oise — qui offrent les écrins les plus spectaculaires. Vaux-le-Vicomte, Chantilly, Champs-sur-Marne, Courances : autant de noms qui font rêver et qui sont accessibles en moins d''une heure depuis le centre de la capitale.</p><p>La région se distingue également par sa logistique exemplaire : deux aéroports internationaux, un réseau TGV dense, des hôtels de toutes catégories pour loger les invités. Un atout décisif pour les mariages avec des invités venus de loin.</p>',
  'Mariage en Île-de-France — Prestataires & Conseils | LesNoces.net',
  'Trouvez les meilleurs prestataires de mariage en Île-de-France. Châteaux, traiteurs étoilés, photographes — sélection éditoriale validée par LesNoces.',
  true
);
