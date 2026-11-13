CREATE TABLE public.modeles_retroplanning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titre text NOT NULL CHECK (length(titre) BETWEEN 1 AND 200),
  description text,
  categorie text NOT NULL,
  mois_avant numeric(5,2) NOT NULL,
  priorite smallint NOT NULL DEFAULT 2 CHECK (priorite BETWEEN 1 AND 3),
  types_ceremonie text[] NOT NULL DEFAULT '{}' CHECK (types_ceremonie <@ ARRAY['civile','religieuse','laique']::text[]),
  categorie_prestataire text,
  message_assistant text CHECK (message_assistant IS NULL OR length(message_assistant) <= 300),
  lien_module text CHECK (lien_module IN ('style','livret')),
  actif boolean NOT NULL DEFAULT true,
  ordre int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.modeles_retroplanning TO authenticated;
GRANT ALL ON public.modeles_retroplanning TO service_role;
ALTER TABLE public.modeles_retroplanning ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Modèles lisibles par les connectés" ON public.modeles_retroplanning FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins créent les modèles" ON public.modeles_retroplanning FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins modifient les modèles" ON public.modeles_retroplanning FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER modeles_retroplanning_updated_at BEFORE UPDATE ON public.modeles_retroplanning
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.taches_couple (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  modele_id uuid REFERENCES public.modeles_retroplanning(id),
  titre text NOT NULL CHECK (length(titre) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR length(description) <= 1000),
  categorie text NOT NULL,
  date_echeance date NOT NULL,
  echeance_origine date,
  echeance_modifiee boolean NOT NULL DEFAULT false,
  priorite smallint NOT NULL DEFAULT 2 CHECK (priorite BETWEEN 1 AND 3),
  faite boolean NOT NULL DEFAULT false,
  faite_le timestamptz,
  masquee boolean NOT NULL DEFAULT false,
  masquee_auto boolean NOT NULL DEFAULT false,
  perso boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, modele_id)
);
CREATE INDEX taches_couple_user_idx ON public.taches_couple(user_id, date_echeance);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.taches_couple TO authenticated;
GRANT ALL ON public.taches_couple TO service_role;
ALTER TABLE public.taches_couple ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Couple lit ses tâches" ON public.taches_couple FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Couple ajoute ses tâches perso" ON public.taches_couple FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND perso AND modele_id IS NULL);
CREATE POLICY "Couple modifie ses tâches" ON public.taches_couple FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Couple supprime ses tâches perso" ON public.taches_couple FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND perso);

-- Protège les champs gérés par la synchro quand c'est le couple qui écrit
CREATE OR REPLACE FUNCTION public.taches_couple_proteger()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.perso := true; NEW.modele_id := NULL; NEW.echeance_origine := NEW.date_echeance;
      NEW.echeance_modifiee := false; NEW.masquee_auto := false;
      IF NEW.faite THEN NEW.faite_le := now(); ELSE NEW.faite_le := NULL; END IF;
      RETURN NEW;
    END IF;
    NEW.user_id := OLD.user_id; NEW.modele_id := OLD.modele_id; NEW.perso := OLD.perso;
    NEW.echeance_origine := OLD.echeance_origine; NEW.created_at := OLD.created_at;
    IF NOT OLD.perso THEN
      NEW.titre := OLD.titre; NEW.description := OLD.description;
      NEW.categorie := OLD.categorie; NEW.priorite := OLD.priorite;
      IF NEW.date_echeance IS DISTINCT FROM OLD.date_echeance THEN NEW.echeance_modifiee := true;
      ELSE NEW.echeance_modifiee := OLD.echeance_modifiee; END IF;
    ELSE
      NEW.echeance_origine := NEW.date_echeance;
    END IF;
    IF NEW.masquee IS DISTINCT FROM OLD.masquee THEN NEW.masquee_auto := false;
    ELSE NEW.masquee_auto := OLD.masquee_auto; END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.faite AND NOT OLD.faite THEN NEW.faite_le := now();
    ELSIF NOT NEW.faite THEN NEW.faite_le := NULL; END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER taches_couple_proteger BEFORE INSERT OR UPDATE ON public.taches_couple
  FOR EACH ROW EXECUTE FUNCTION public.taches_couple_proteger();

CREATE OR REPLACE FUNCTION public.echeance_retroplanning(_ref date, _mois_avant numeric)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (_ref
    - make_interval(months => trunc(_mois_avant)::int)
    - make_interval(days => trunc((_mois_avant - trunc(_mois_avant)) * 30)::int))::date
$$;

CREATE OR REPLACE FUNCTION public.date_reference_mariage(_uid uuid)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(date_mariage,
    CASE WHEN date_mois IS NOT NULL AND date_annee IS NOT NULL THEN make_date(date_annee, date_mois, 15) END)
  FROM public.profils_mariage WHERE user_id = _uid
$$;

CREATE OR REPLACE FUNCTION public.synchroniser_taches_couple(_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ref date; _types text[];
BEGIN
  SELECT public.date_reference_mariage(_uid), COALESCE(types_ceremonie, '{}')
    INTO _ref, _types FROM public.profils_mariage WHERE user_id = _uid;
  IF _ref IS NULL THEN RETURN; END IF;

  -- civile (et « toutes ») s'appliquent à tout le monde ; religieuse / laïque seulement si cochées
  CREATE TEMP TABLE IF NOT EXISTS _pertinents (id uuid PRIMARY KEY) ON COMMIT DROP;
  DELETE FROM _pertinents;
  INSERT INTO _pertinents
    SELECT m.id FROM public.modeles_retroplanning m
    WHERE m.actif AND (cardinality(m.types_ceremonie) = 0 OR 'civile' = ANY(m.types_ceremonie) OR m.types_ceremonie && _types);

  INSERT INTO public.taches_couple (user_id, modele_id, titre, description, categorie, date_echeance, echeance_origine, priorite)
  SELECT _uid, m.id, m.titre, m.description, m.categorie,
         public.echeance_retroplanning(_ref, m.mois_avant), public.echeance_retroplanning(_ref, m.mois_avant), m.priorite
  FROM public.modeles_retroplanning m JOIN _pertinents p ON p.id = m.id
  ON CONFLICT (user_id, modele_id) DO NOTHING;

  -- Tâches non faites issues d'un modèle : contenu et échéances à jour
  UPDATE public.taches_couple t SET
    titre = m.titre, description = m.description, categorie = m.categorie, priorite = m.priorite,
    echeance_origine = public.echeance_retroplanning(_ref, m.mois_avant),
    date_echeance = CASE WHEN t.echeance_modifiee THEN t.date_echeance ELSE public.echeance_retroplanning(_ref, m.mois_avant) END
  FROM public.modeles_retroplanning m
  WHERE t.user_id = _uid AND t.modele_id = m.id AND NOT t.faite;

  -- Plus pertinentes : masquées (jamais supprimées, cochées conservées)
  UPDATE public.taches_couple t SET masquee = true, masquee_auto = true
  WHERE t.user_id = _uid AND t.modele_id IS NOT NULL AND NOT t.faite AND NOT t.masquee
    AND t.modele_id NOT IN (SELECT id FROM _pertinents);
  -- Redevenues pertinentes : réaffichées si c'est la synchro qui les avait masquées
  UPDATE public.taches_couple t SET masquee = false, masquee_auto = false
  WHERE t.user_id = _uid AND t.masquee_auto AND t.modele_id IN (SELECT id FROM _pertinents);
END $$;
REVOKE EXECUTE ON FUNCTION public.synchroniser_taches_couple(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.date_reference_mariage(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_profil_synchro_taches()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.synchroniser_taches_couple(NEW.user_id);
  RETURN NULL;
END $$;
CREATE TRIGGER profils_mariage_synchro_taches
  AFTER INSERT OR UPDATE OF date_mariage, date_mois, date_annee, types_ceremonie ON public.profils_mariage
  FOR EACH ROW EXECUTE FUNCTION public.trg_profil_synchro_taches();

CREATE OR REPLACE FUNCTION public.trg_modeles_synchro_taches()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _u uuid;
BEGIN
  FOR _u IN SELECT user_id FROM public.profils_mariage
    WHERE public.date_reference_mariage(user_id) >= current_date LOOP
    PERFORM public.synchroniser_taches_couple(_u);
  END LOOP;
  RETURN NULL;
END $$;
CREATE TRIGGER modeles_retroplanning_synchro AFTER INSERT OR UPDATE ON public.modeles_retroplanning
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_modeles_synchro_taches();

INSERT INTO public.modeles_retroplanning (ordre, titre, categorie, mois_avant, priorite, types_ceremonie, categorie_prestataire, lien_module, message_assistant, description) VALUES
(1,'Fixer le budget global','Organisation',12,1,'{}',NULL,NULL,NULL,'Décidez ensemble de l''enveloppe totale avant de contacter les prestataires.'),
(2,'Établir une première liste d''invités','Invités',12,1,'{}',NULL,NULL,NULL,'Une estimation du nombre d''invités oriente le choix du lieu et du traiteur.'),
(3,'Choisir la date et la région','Organisation',12,1,'{}',NULL,NULL,NULL,'Gardez une ou deux dates de repli : les lieux recherchés sont vite réservés.'),
(4,'Faire appel à un wedding planner','Prestataires',12,3,'{}','Wedding planner',NULL,'Nous cherchons un wedding planner pour notre mariage.','Un wedding planner peut tout coordonner, ou seulement le jour J.'),
(5,'Réserver le lieu de réception','Prestataires',12,1,'{}','Lieux de réception',NULL,'Nous cherchons un lieu de réception pour notre mariage.','Visitez plusieurs lieux et vérifiez capacité, hébergement et horaires de fin.'),
(6,'Contacter la paroisse','Cérémonie',12,1,'{religieuse}',NULL,NULL,NULL,'Prenez contact tôt pour réserver l''église et connaître le parcours de préparation.'),
(7,'Définir notre style et notre charte','Style',11,2,'{}',NULL,'style',NULL,'Couleurs, polices et monogramme donneront une unité à tout votre mariage.'),
(8,'Réserver le traiteur','Prestataires',11,1,'{}','Traiteur & Gastronomie',NULL,'Nous cherchons un traiteur pour notre mariage.','Demandez plusieurs devis et prévoyez une dégustation.'),
(9,'Réserver le photographe','Prestataires',11,1,'{}','Photographe / Vidéaste',NULL,'Nous cherchons un photographe pour notre mariage.','Les photographes appréciés sont réservés longtemps à l''avance.'),
(10,'Réserver le vidéaste','Prestataires',10,3,'{}','Photographe / Vidéaste',NULL,'Nous cherchons un vidéaste pour notre mariage.','Un film garde la mémoire des voix, des discours et de l''ambiance.'),
(11,'Réserver le DJ ou les musiciens','Prestataires',10,1,'{}','Musicien & DJ',NULL,'Nous cherchons un DJ ou des musiciens pour notre mariage.','Pensez à la cérémonie, au cocktail et à la soirée.'),
(12,'Choisir l''officiant de la cérémonie laïque','Cérémonie',10,1,'{laique}','Officiant de cérémonie',NULL,'Nous cherchons un officiant pour notre cérémonie laïque.','L''officiant vous aide à construire une cérémonie qui vous ressemble.'),
(13,'Commencer à chercher la robe','Tenues',10,1,'{}','Vêtements mariage',NULL,'Nous cherchons une boutique de robes de mariée.','Prenez rendez-vous dans plusieurs boutiques pour comparer les styles.'),
(14,'Envoyer les save-the-date','Invités',9,2,'{}','Faire-parts',NULL,'Nous cherchons un créateur de faire-part.','Prévenez vos invités pour qu''ils bloquent la date.'),
(15,'Réserver un bloc de chambres pour les invités','Invités',8,2,'{}','Hébergements',NULL,'Nous cherchons un hébergement pour nos invités.','Les hébergements proches du lieu partent vite en haute saison.'),
(16,'Commander la robe','Tenues',8,1,'{}','Vêtements mariage',NULL,'Nous cherchons une boutique de robes de mariée.','Comptez plusieurs mois de fabrication et de retouches.'),
(17,'Réserver le fleuriste','Prestataires',8,1,'{}','Fleuriste',NULL,'Nous cherchons un fleuriste pour notre mariage.','Montrez-lui votre charte pour accorder bouquets et décoration.'),
(18,'Réserver la décoration et la location de matériel','Prestataires',7,2,'{}','Décoration',NULL,'Nous cherchons un décorateur ou de la location de matériel pour notre mariage.','Mobilier, vaisselle, éclairage : vérifiez ce que le lieu fournit déjà.'),
(19,'Commander les faire-part','Papeterie',6,1,'{}','Faire-parts',NULL,'Nous cherchons un créateur de faire-part.','Prévoyez le temps d''impression et de relecture.'),
(20,'Commencer la préparation au mariage religieux','Cérémonie',6,1,'{religieuse}',NULL,NULL,NULL,'La préparation se déroule en général sur plusieurs rencontres.'),
(21,'Ouvrir la liste de mariage','Invités',6,2,'{}',NULL,NULL,NULL,'Indiquez-la sur vos faire-part ou votre site de mariage.'),
(22,'Choisir le costume','Tenues',5,1,'{}','Vêtements mariage',NULL,'Nous cherchons un costume de marié.','Un costume sur mesure demande plusieurs essayages.'),
(23,'Commander le wedding cake','Prestataires',5,2,'{}','Traiteur & Gastronomie',NULL,'Nous cherchons un wedding cake pour notre mariage.','Choisissez les saveurs et le décor lors d''une dégustation.'),
(24,'Envoyer les faire-part','Invités',4,1,'{}',NULL,NULL,NULL,'Donnez une date limite de réponse pour préparer le plan de table.'),
(25,'Choisir les alliances','Tenues',4,1,'{}','Bijoux de mariage',NULL,'Nous cherchons nos alliances.','Prévoyez le temps de mise à taille et de gravure.'),
(26,'Réserver coiffure et maquillage, avec essai','Tenues',4,2,'{}','Beauté',NULL,'Nous cherchons une coiffeuse et une maquilleuse pour le jour J.','Un essai permet d''ajuster la coiffure et le maquillage à la tenue.'),
(27,'Réserver le transport','Prestataires',4,3,'{}','Transport & Véhicules',NULL,'Nous cherchons une voiture pour notre mariage.','Voiture des mariés, navette pour les invités : pensez au retour.'),
(28,'Déposer le dossier de mariage à la mairie (délai selon votre mairie)','Administratif',3,1,'{civile}',NULL,NULL,NULL,'Renseignez-vous auprès de votre mairie sur les pièces et le délai demandés.'),
(29,'Faire la dégustation du menu','Prestataires',3,2,'{}',NULL,NULL,NULL,'Validez le menu définitif et les éventuels régimes particuliers.'),
(30,'Préparer le livret de cérémonie','Cérémonie',2,2,'{}',NULL,'livret',NULL,'Textes, chants et déroulé, aux couleurs de votre charte.'),
(31,'Relancer les invités qui n''ont pas répondu','Invités',2,2,'{}',NULL,NULL,NULL,'Un message rapide suffit pour obtenir les dernières réponses.'),
(32,'Faire le plan de table','Invités',1,1,'{}',NULL,NULL,NULL,'Transmettez-le au lieu et au traiteur une fois terminé.'),
(33,'Confirmer horaires et adresses avec chaque prestataire','Organisation',1,1,'{}',NULL,NULL,NULL,'Un dernier point évite les mauvaises surprises le jour J.'),
(34,'Dernier essayage des tenues','Tenues',1,1,'{}',NULL,NULL,NULL,'Venez avec vos chaussures et accessoires.'),
(35,'Préparer le déroulé du jour J pour les prestataires','Organisation',0.5,1,'{}',NULL,NULL,NULL,'Horaires, contacts et adresses sur une seule page pour tout le monde.'),
(36,'Préparer les règlements des soldes','Organisation',0.25,2,'{}',NULL,NULL,NULL,'Préparez les chèques ou virements à remettre le jour J.'),
(37,'Envoyer les remerciements','Après le mariage',-1,2,'{}',NULL,NULL,NULL,'Un petit mot avec une photo fait toujours plaisir.'),
(38,'Laisser un avis à vos prestataires','Après le mariage',-0.5,2,'{}',NULL,NULL,NULL,'Votre avis aide les futurs mariés à choisir.');