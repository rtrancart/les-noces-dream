
-- ============================================================
-- LesNoces.net — Migration Phase 1 : Toutes les tables
-- Nommage en français, snake_case minuscule
-- ============================================================

-- 1. ENUMS
CREATE TYPE public.app_role AS ENUM ('client', 'prestataire', 'admin', 'super_admin');
CREATE TYPE public.statut_prestataire AS ENUM ('brouillon', 'en_attente', 'a_corriger', 'actif', 'suspendu', 'archive');
CREATE TYPE public.plan_abonnement AS ENUM ('essai', 'mensuel', 'annuel');
CREATE TYPE public.statut_abonnement AS ENUM ('actif', 'en_retard', 'en_pause', 'resilie', 'annule', 'expire');
CREATE TYPE public.objet_demande AS ENUM ('mariage', 'evenement_entreprise', 'cocktail', 'autre');
CREATE TYPE public.statut_demande AS ENUM ('nouveau', 'lu', 'en_discussion', 'devis_envoye', 'accepte', 'refuse', 'archive');
CREATE TYPE public.expediteur_type AS ENUM ('prestataire', 'visiteur');
CREATE TYPE public.type_champ AS ENUM ('texte', 'nombre', 'booleen', 'liste', 'date');
CREATE TYPE public.statut_avis AS ENUM ('en_attente', 'valide', 'rejete');
CREATE TYPE public.type_notification AS ENUM ('nouvelle_demande', 'nouveau_message', 'avis', 'abonnement', 'boost', 'systeme');
CREATE TYPE public.pack_boost AS ENUM ('5j_5eur', '15j_12eur', '30j_20eur');
CREATE TYPE public.emplacement_boost AS ENUM ('listing_top', 'listing_sidebar', 'accueil_coups_de_coeur');
CREATE TYPE public.statut_boost AS ENUM ('actif', 'expire', 'rembourse');
CREATE TYPE public.type_planificateur AS ENUM ('checklist', 'budget', 'invites', 'planning');

-- 2. FUNCTION update_updated_at (trigger générique)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. TABLE: profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  prenom text,
  nom text,
  telephone text,
  avatar_url text,
  date_naissance date,
  preferences_notifications jsonb DEFAULT '{"email": true, "sms": false}'::jsonb,
  cgu_acceptees_le timestamptz,
  compte_supprime_le timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. TABLE: user_roles (rôles séparés — sécurité)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Fonction has_role (security definer)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. TABLE: categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  slug text UNIQUE NOT NULL,
  description_seo text,
  contenu_seo text,
  parent_id uuid REFERENCES public.categories(id),
  icone_url text,
  ordre_affichage int DEFAULT 0,
  est_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. TABLE: prestataires
CREATE TABLE public.prestataires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES public.profiles(id),
  nom_commercial text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  description_courte text,
  prix_depart int,
  prix_max int,
  categorie_mere_id uuid NOT NULL REFERENCES public.categories(id),
  categorie_fille_id uuid REFERENCES public.categories(id),
  adresse text,
  ville text NOT NULL,
  code_postal text,
  region text NOT NULL,
  latitude float8,
  longitude float8,
  site_web text,
  telephone text,
  email_contact text,
  urls_galerie text[] DEFAULT '{}',
  photo_principale_url text,
  video_url text,
  tags text[] DEFAULT '{}',
  champs_specifiques jsonb,
  statut statut_prestataire NOT NULL DEFAULT 'brouillon',
  date_premiere_publication timestamptz,
  est_premium boolean DEFAULT false,
  est_verifie boolean DEFAULT false,
  fin_visibilite_boost timestamptz,
  note_qualite_prestation float4 DEFAULT 0,
  note_professionnalisme float4 DEFAULT 0,
  note_rapport_qualite_prix float4 DEFAULT 0,
  note_flexibilite float4 DEFAULT 0,
  note_moyenne float4 DEFAULT 0,
  nombre_avis int DEFAULT 0,
  nombre_demandes int DEFAULT 0,
  metadonnees_seo jsonb,
  notes_admin text,
  motif_suspension text,
  cree_par_admin boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.prestataires ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_prestataires_updated_at BEFORE UPDATE ON public.prestataires FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index pour recherche
CREATE INDEX idx_prestataires_statut ON public.prestataires(statut);
CREATE INDEX idx_prestataires_categorie ON public.prestataires(categorie_mere_id);
CREATE INDEX idx_prestataires_region ON public.prestataires(region);
CREATE INDEX idx_prestataires_ville ON public.prestataires(ville);
CREATE INDEX idx_prestataires_slug ON public.prestataires(slug);

-- 7. TABLE: abonnements
CREATE TABLE public.abonnements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestataire_id uuid NOT NULL REFERENCES public.prestataires(id),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_payment_method_id text,
  plan plan_abonnement NOT NULL DEFAULT 'essai',
  montant_cents int DEFAULT 6900,
  debut_le timestamptz NOT NULL DEFAULT now(),
  fin_essai_le timestamptz,
  fin_periode_le timestamptz,
  statut statut_abonnement NOT NULL DEFAULT 'actif',
  resilie_le timestamptz,
  adresse_facturation jsonb,
  derniere_facture_id text,
  nb_echecs_paiement int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.abonnements ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_abonnements_updated_at BEFORE UPDATE ON public.abonnements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. TABLE: contacts_anonymes
CREATE TABLE public.contacts_anonymes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  prenom text,
  telephone text,
  profile_id uuid REFERENCES public.profiles(id),
  merged_le timestamptz,
  origine_premiere text NOT NULL DEFAULT 'formulaire_contact',
  mailchimp_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contacts_anonymes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_contacts_anonymes_updated_at BEFORE UPDATE ON public.contacts_anonymes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. TABLE: demandes_devis
CREATE TABLE public.demandes_devis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts_anonymes(id),
  profile_id uuid REFERENCES public.profiles(id),
  nom_contact text NOT NULL,
  email_contact text NOT NULL,
  telephone_contact text,
  nombre_invites_rang text,
  prestataire_id uuid NOT NULL REFERENCES public.prestataires(id),
  objet objet_demande NOT NULL DEFAULT 'mariage',
  message text NOT NULL,
  date_evenement date,
  lieu_evenement text,
  budget_indicatif int,
  statut statut_demande NOT NULL DEFAULT 'nouveau',
  source text DEFAULT 'lesnoces.net',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.demandes_devis ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_demandes_devis_updated_at BEFORE UPDATE ON public.demandes_devis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. TABLE: messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demande_id uuid NOT NULL REFERENCES public.demandes_devis(id),
  expediteur_type expediteur_type NOT NULL,
  expediteur_id uuid REFERENCES public.profiles(id),
  contenu text NOT NULL,
  envoye_par_email boolean DEFAULT false,
  lu_le timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 11. TABLE: champs_categories
CREATE TABLE public.champs_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categorie_id uuid NOT NULL REFERENCES public.categories(id),
  cle text NOT NULL,
  label text NOT NULL,
  type_champ type_champ NOT NULL DEFAULT 'texte',
  options_liste text[],
  obligatoire boolean DEFAULT false,
  visible_public boolean DEFAULT true,
  ordre_affichage int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.champs_categories ENABLE ROW LEVEL SECURITY;

-- 12. TABLE: avis
CREATE TABLE public.avis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestataire_id uuid NOT NULL REFERENCES public.prestataires(id),
  client_id uuid REFERENCES public.profiles(id),
  contact_id uuid REFERENCES public.contacts_anonymes(id),
  demande_id uuid REFERENCES public.demandes_devis(id),
  note_qualite_presta smallint NOT NULL CHECK (note_qualite_presta BETWEEN 1 AND 5),
  note_professionnalisme smallint NOT NULL CHECK (note_professionnalisme BETWEEN 1 AND 5),
  note_rapport_qualite_prix smallint NOT NULL CHECK (note_rapport_qualite_prix BETWEEN 1 AND 5),
  note_flexibilite smallint NOT NULL CHECK (note_flexibilite BETWEEN 1 AND 5),
  note_globale float4 NOT NULL,
  titre text,
  commentaire text NOT NULL,
  statut statut_avis NOT NULL DEFAULT 'en_attente',
  reponse_prestataire text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.avis ENABLE ROW LEVEL SECURITY;

-- 13. TABLE: favoris
CREATE TABLE public.favoris (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prestataire_id uuid NOT NULL REFERENCES public.prestataires(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, prestataire_id)
);
ALTER TABLE public.favoris ENABLE ROW LEVEL SECURITY;

-- 14. TABLE: planificateur
CREATE TABLE public.planificateur (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nom_projet text DEFAULT 'Mon Mariage',
  date_evenement date,
  type type_planificateur NOT NULL,
  donnees jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.planificateur ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_planificateur_updated_at BEFORE UPDATE ON public.planificateur FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 15. TABLE: notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type type_notification NOT NULL,
  titre text NOT NULL,
  corps text NOT NULL,
  lien text,
  lu boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 16. TABLE: pages_contenu
CREATE TABLE public.pages_contenu (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  titre text NOT NULL,
  builder_io_content_id text,
  meta_title text,
  meta_description text,
  est_publiee boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pages_contenu ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_pages_contenu_updated_at BEFORE UPDATE ON public.pages_contenu FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 17. TABLE: articles_blog
CREATE TABLE public.articles_blog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  titre text NOT NULL,
  extrait text,
  builder_io_content_id text,
  auteur_id uuid REFERENCES public.profiles(id),
  categorie_blog text,
  tags text[] DEFAULT '{}',
  image_couverture_url text,
  est_publie boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.articles_blog ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_articles_blog_updated_at BEFORE UPDATE ON public.articles_blog FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 18. TABLE: boosts_visibilite
CREATE TABLE public.boosts_visibilite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestataire_id uuid NOT NULL REFERENCES public.prestataires(id),
  stripe_payment_intent_id text,
  pack pack_boost NOT NULL,
  emplacement emplacement_boost NOT NULL,
  zone text,
  capacite_max int DEFAULT 3,
  montant_cents int NOT NULL,
  debut_le timestamptz NOT NULL,
  fin_le timestamptz NOT NULL,
  statut statut_boost NOT NULL DEFAULT 'actif',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.boosts_visibilite ENABLE ROW LEVEL SECURITY;

-- 19. TABLE: logs_admin
CREATE TABLE public.logs_admin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id),
  action text NOT NULL,
  entite text,
  entite_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.logs_admin ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- profiles: public read, owner or admin update
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- user_roles: admin select, super_admin manage
CREATE POLICY "Admins can view roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Super admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- categories: public read, admin write
CREATE POLICY "Categories are viewable by everyone" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- prestataires: public read actifs, owner+admin full
CREATE POLICY "Public can view active prestataires" ON public.prestataires FOR SELECT USING (statut = 'actif' OR auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner can update own prestataire" ON public.prestataires FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owner can insert prestataire" ON public.prestataires FOR INSERT WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage prestataires" ON public.prestataires FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- abonnements: owner+admin
CREATE POLICY "Owner can view own abonnement" ON public.abonnements FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.prestataires WHERE prestataires.id = abonnements.prestataire_id AND prestataires.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Admins can manage abonnements" ON public.abonnements FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- contacts_anonymes: admin+service only (no public direct access)
CREATE POLICY "Admins can manage contacts" ON public.contacts_anonymes FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- demandes_devis: insert public (via edge function), select by participants+admin
CREATE POLICY "Anyone can create demande" ON public.demandes_devis FOR INSERT WITH CHECK (true);
CREATE POLICY "Participants can view demandes" ON public.demandes_devis FOR SELECT USING (
  profile_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.prestataires WHERE prestataires.id = demandes_devis.prestataire_id AND prestataires.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Admins can manage demandes" ON public.demandes_devis FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- messages: participants only
CREATE POLICY "Participants can view messages" ON public.messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.demandes_devis dd
    WHERE dd.id = messages.demande_id
    AND (dd.profile_id = auth.uid() OR EXISTS (SELECT 1 FROM public.prestataires p WHERE p.id = dd.prestataire_id AND p.user_id = auth.uid()))
  )
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Participants can insert messages" ON public.messages FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.demandes_devis dd
    WHERE dd.id = messages.demande_id
    AND (dd.profile_id = auth.uid() OR EXISTS (SELECT 1 FROM public.prestataires p WHERE p.id = dd.prestataire_id AND p.user_id = auth.uid()))
  )
);

-- champs_categories: public read, admin write
CREATE POLICY "Public can view champs" ON public.champs_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage champs" ON public.champs_categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- avis: public read valides, authenticated insert, admin manage
CREATE POLICY "Public can view validated avis" ON public.avis FOR SELECT USING (statut = 'valide' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can insert avis" ON public.avis FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage avis" ON public.avis FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- favoris: owner only
CREATE POLICY "Users can view own favoris" ON public.favoris FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own favoris" ON public.favoris FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own favoris" ON public.favoris FOR DELETE USING (auth.uid() = user_id);

-- planificateur: owner only
CREATE POLICY "Users can view own planificateur" ON public.planificateur FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own planificateur" ON public.planificateur FOR ALL USING (auth.uid() = user_id);

-- notifications: owner only
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- pages_contenu: public read publiées, admin manage
CREATE POLICY "Public can view published pages" ON public.pages_contenu FOR SELECT USING (est_publiee = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage pages" ON public.pages_contenu FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- articles_blog: public read publiés, admin manage
CREATE POLICY "Public can view published articles" ON public.articles_blog FOR SELECT USING (est_publie = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage articles" ON public.articles_blog FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- boosts_visibilite: owner+admin
CREATE POLICY "Owner can view own boosts" ON public.boosts_visibilite FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.prestataires WHERE prestataires.id = boosts_visibilite.prestataire_id AND prestataires.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Admins can manage boosts" ON public.boosts_visibilite FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- logs_admin: admin only
CREATE POLICY "Admins can view logs" ON public.logs_admin FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert logs" ON public.logs_admin FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- TRIGGERS
-- ============================================================

-- on_auth_user_created: create profile + merge contacts_anonymes
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);

  -- Default role = client
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');

  -- Merge contacts_anonymes if email exists
  UPDATE public.contacts_anonymes
  SET profile_id = NEW.id, merged_le = now()
  WHERE email = NEW.email AND profile_id IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- sync_note_prestataire: recalculate ratings on avis changes
CREATE OR REPLACE FUNCTION public.sync_note_prestataire()
RETURNS TRIGGER AS $$
DECLARE
  target_prestataire_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_prestataire_id := OLD.prestataire_id;
  ELSE
    target_prestataire_id := NEW.prestataire_id;
  END IF;

  UPDATE public.prestataires SET
    note_qualite_prestation = COALESCE((SELECT AVG(note_qualite_presta) FROM public.avis WHERE prestataire_id = target_prestataire_id AND statut = 'valide'), 0),
    note_professionnalisme = COALESCE((SELECT AVG(note_professionnalisme) FROM public.avis WHERE prestataire_id = target_prestataire_id AND statut = 'valide'), 0),
    note_rapport_qualite_prix = COALESCE((SELECT AVG(note_rapport_qualite_prix) FROM public.avis WHERE prestataire_id = target_prestataire_id AND statut = 'valide'), 0),
    note_flexibilite = COALESCE((SELECT AVG(note_flexibilite) FROM public.avis WHERE prestataire_id = target_prestataire_id AND statut = 'valide'), 0),
    note_moyenne = COALESCE(
      (SELECT (SUM(note_qualite_presta * 2) + SUM(note_professionnalisme) + SUM(note_rapport_qualite_prix) + SUM(note_flexibilite))::float / (COUNT(*) * 5)
       FROM public.avis WHERE prestataire_id = target_prestataire_id AND statut = 'valide'), 0),
    nombre_avis = (SELECT COUNT(*) FROM public.avis WHERE prestataire_id = target_prestataire_id AND statut = 'valide')
  WHERE id = target_prestataire_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER sync_note_prestataire_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.avis
  FOR EACH ROW EXECUTE FUNCTION public.sync_note_prestataire();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('prestataires-photos', 'prestataires-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('documents-admin', 'documents-admin', false);

-- Storage policies
CREATE POLICY "Public can view prestataires photos" ON storage.objects FOR SELECT USING (bucket_id = 'prestataires-photos');
CREATE POLICY "Authenticated can upload prestataires photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'prestataires-photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Public can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage documents" ON storage.objects FOR ALL USING (bucket_id = 'documents-admin' AND public.has_role(auth.uid(), 'admin'));
