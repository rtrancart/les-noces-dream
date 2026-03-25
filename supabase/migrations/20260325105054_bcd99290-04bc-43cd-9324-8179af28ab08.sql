
-- categories
DROP POLICY "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories" ON public.categories
FOR ALL TO public
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- demandes_devis
DROP POLICY "Admins can manage demandes" ON public.demandes_devis;
CREATE POLICY "Admins can manage demandes" ON public.demandes_devis
FOR ALL TO public
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY "Participants can view demandes" ON public.demandes_devis;
CREATE POLICY "Participants can view demandes" ON public.demandes_devis
FOR SELECT TO public
USING (
  (profile_id = auth.uid())
  OR (EXISTS (SELECT 1 FROM prestataires WHERE prestataires.id = demandes_devis.prestataire_id AND prestataires.user_id = auth.uid()))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- logs_admin
DROP POLICY "Admins can insert logs" ON public.logs_admin;
CREATE POLICY "Admins can insert logs" ON public.logs_admin
FOR INSERT TO public
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY "Admins can view logs" ON public.logs_admin;
CREATE POLICY "Admins can view logs" ON public.logs_admin
FOR SELECT TO public
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- champs_categories
DROP POLICY "Admins can manage champs" ON public.champs_categories;
CREATE POLICY "Admins can manage champs" ON public.champs_categories
FOR ALL TO public
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- articles_blog
DROP POLICY "Admins can manage articles" ON public.articles_blog;
CREATE POLICY "Admins can manage articles" ON public.articles_blog
FOR ALL TO public
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY "Public can view published articles" ON public.articles_blog;
CREATE POLICY "Public can view published articles" ON public.articles_blog
FOR SELECT TO public
USING (est_publie = true OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- avis
DROP POLICY "Admins can manage avis" ON public.avis;
CREATE POLICY "Admins can manage avis" ON public.avis
FOR ALL TO public
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY "Public can view validated avis" ON public.avis;
CREATE POLICY "Public can view validated avis" ON public.avis
FOR SELECT TO public
USING (statut = 'valide'::statut_avis OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- boosts_visibilite
DROP POLICY "Admins can manage boosts" ON public.boosts_visibilite;
CREATE POLICY "Admins can manage boosts" ON public.boosts_visibilite
FOR ALL TO public
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY "Owner can view own boosts" ON public.boosts_visibilite;
CREATE POLICY "Owner can view own boosts" ON public.boosts_visibilite
FOR SELECT TO public
USING (
  (EXISTS (SELECT 1 FROM prestataires WHERE prestataires.id = boosts_visibilite.prestataire_id AND prestataires.user_id = auth.uid()))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- pages_contenu
DROP POLICY "Admins can manage pages" ON public.pages_contenu;
CREATE POLICY "Admins can manage pages" ON public.pages_contenu
FOR ALL TO public
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY "Public can view published pages" ON public.pages_contenu;
CREATE POLICY "Public can view published pages" ON public.pages_contenu
FOR SELECT TO public
USING (est_publiee = true OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- contacts_anonymes
DROP POLICY "Admins can manage contacts" ON public.contacts_anonymes;
CREATE POLICY "Admins can manage contacts" ON public.contacts_anonymes
FOR ALL TO public
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- profiles (admin update)
DROP POLICY "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles
FOR UPDATE TO public
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- abonnements
DROP POLICY "Admins can manage abonnements" ON public.abonnements;
CREATE POLICY "Admins can manage abonnements" ON public.abonnements
FOR ALL TO public
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY "Owner can view own abonnement" ON public.abonnements;
CREATE POLICY "Owner can view own abonnement" ON public.abonnements
FOR SELECT TO public
USING (
  (EXISTS (SELECT 1 FROM prestataires WHERE prestataires.id = abonnements.prestataire_id AND prestataires.user_id = auth.uid()))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- messages
DROP POLICY "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages" ON public.messages
FOR SELECT TO public
USING (
  (EXISTS (SELECT 1 FROM demandes_devis dd WHERE dd.id = messages.demande_id AND (dd.profile_id = auth.uid() OR EXISTS (SELECT 1 FROM prestataires p WHERE p.id = dd.prestataire_id AND p.user_id = auth.uid()))))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- user_roles (view policy)
DROP POLICY "Admins can view roles" ON public.user_roles;
CREATE POLICY "Admins can view roles" ON public.user_roles
FOR SELECT TO public
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
