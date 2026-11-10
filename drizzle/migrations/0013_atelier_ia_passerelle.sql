ALTER TABLE public.ia_logs DROP CONSTRAINT IF EXISTS ia_logs_usage_check;
ALTER TABLE public.ia_logs ADD CONSTRAINT ia_logs_usage_check
  CHECK (usage IN ('tags_ia','embedding','test','assistant','filtres','livret','charte','vision'));
ALTER TABLE public.ia_logs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cout_eur numeric(12,6),
  ADD COLUMN IF NOT EXISTS stop_reason text;
CREATE INDEX IF NOT EXISTS idx_ia_logs_user_created ON public.ia_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ia_logs_usage_created ON public.ia_logs (usage, created_at DESC);

CREATE TABLE public.ia_reglages (
  cle text PRIMARY KEY,
  valeur jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ia_reglages TO authenticated;
GRANT ALL ON public.ia_reglages TO service_role;
ALTER TABLE public.ia_reglages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gèrent ia_reglages" ON public.ia_reglages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
INSERT INTO public.ia_reglages (cle, valeur, description) VALUES
  ('quotas_defaut', '{"assistant_par_jour":50,"filtres_par_jour":100,"livret_total":5,"charte_total":10,"vision_total":10}', 'Plafonds par défaut par couple'),
  ('budget_mensuel_eur', '50', 'Budget IA mensuel global (€)'),
  ('budget_seuils_pct', '{"alerte":80,"degrade":100,"bloque":120}', 'Seuils en % du budget : alerte email, mode dégradé, suspension'),
  ('email_alerte_budget', '"rodolphe@lesnoces.net"', 'Destinataire de l''alerte budget')
ON CONFLICT (cle) DO NOTHING;

CREATE TABLE public.prompts_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usage text NOT NULL CHECK (usage IN ('assistant','filtres','livret','charte','vision')),
  version integer NOT NULL DEFAULT 1,
  titre text NOT NULL,
  contenu text NOT NULL,
  max_tokens integer NOT NULL DEFAULT 1500 CHECK (max_tokens BETWEEN 1 AND 16000),
  format_json boolean NOT NULL DEFAULT false,
  actif boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_prompts_ia_usage_version UNIQUE (usage, version)
);
CREATE UNIQUE INDEX uq_prompts_ia_un_actif ON public.prompts_ia (usage) WHERE actif;
GRANT SELECT, INSERT, UPDATE ON public.prompts_ia TO authenticated;
GRANT ALL ON public.prompts_ia TO service_role;
ALTER TABLE public.prompts_ia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gèrent prompts_ia" ON public.prompts_ia FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_prompts_ia_updated BEFORE UPDATE ON public.prompts_ia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.prompts_ia (usage, version, titre, contenu, max_tokens, format_json, actif) VALUES
('filtres', 1, 'Extraction de filtres de recherche', $p$Tu es le moteur de recherche de LesNoces.net, une marketplace française de prestataires de mariage.
Ta seule tâche : transformer la demande d'un couple en filtres de recherche. Tu ne recommandes aucun prestataire.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format :
{
  "categorie": une valeur de la liste ci-dessous, ou null,
  "sous_categorie": une valeur de la liste ci-dessous, ou null,
  "departements": liste de numéros de département déduite des villes ou régions citées, ou [],
  "date_mariage": "AAAA-MM-JJ" ou "AAAA-MM" ou null,
  "nb_invites": nombre ou null,
  "budget_max_eur": nombre ou null,
  "intention": une phrase courte qui reprend le style et les attentes exprimés par le couple, avec ses propres mots,
  "exclusions": liste de ce que le couple ne veut pas,
  "criteres_pratiques": liste de contraintes pratiques exprimées (ex. "accepte les chèques", "sans acompte", "accessible en fauteuil roulant", "option végétarienne"), ou [],
  "hors_perimetre": true si la demande ne concerne pas la recherche d'un prestataire, sinon false
}

Catégories et sous-catégories autorisées :
Agents de sécurité ; Animation (Magicien & illusionniste, Animateur) ; Artificier ; Barmen ; Beauté (Coiffure, Institut de beauté / Maquillage) ; Bijoux de mariage ; Caviste / Domaine viticole ; Décoration ; Faire-parts ; Fleuriste ; Graphistes & Designer ; Hébergements (Chambre d'hôtes, Gîte, Hôtel) ; Lieux de réception (Châteaux, Manoirs / lieux atypiques) ; Location de matériel (Mobilier et autres, Son & Lumière) ; Musicien & DJ ; Nounous et Animatrice enfants ; Officiant de cérémonie ; Photographe / Vidéaste (Photographe, Vidéaste) ; Service de ménage ; Traiteur & Gastronomie (Chef à domicile, Pâtissier, Restaurant / Traiteur, Wedding Cake) ; Transport & Véhicules (Taxi, Hélicoptères / Calèches / Autres, Voiture de luxe / de collection) ; Vêtements mariage (Accessoires, Costume, Lingerie, Robes de mariées) ; Wedding planner.

Règles :
- N'invente aucune information absente de la demande : mets null ou [].
- "sous_categorie" reste null, sauf si le couple nomme explicitement la sous-catégorie (ex. « un château », « une wedding cake designer »). Ne la déduis jamais.
- Si plusieurs catégories sont demandées, choisis la principale et cite les autres dans "intention".
- N'ajoute dans "intention" aucun adjectif que le couple n'a pas exprimé.$p$, 1000, true, true),
('assistant', 1, 'Conseiller mariage', 'À rédiger (étape 3 à 6)', 1500, false, false),
('livret', 1, 'Livret de mariage', 'À rédiger (étape 3 à 6)', 4000, true, false),
('charte', 1, 'Charte d''ambiance', 'À rédiger (étape 3 à 6)', 2500, false, false),
('vision', 1, 'Photo d''inspiration', 'À rédiger (étape 3 à 6)', 1000, false, false);

CREATE TABLE public.ia_quotas (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  jour date NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Paris')::date,
  assistant_jour integer NOT NULL DEFAULT 0,
  filtres_jour integer NOT NULL DEFAULT 0,
  livret_total integer NOT NULL DEFAULT 0,
  charte_total integer NOT NULL DEFAULT 0,
  vision_total integer NOT NULL DEFAULT 0,
  bonus_assistant integer NOT NULL DEFAULT 0,
  bonus_filtres integer NOT NULL DEFAULT 0,
  bonus_livret integer NOT NULL DEFAULT 0,
  bonus_charte integer NOT NULL DEFAULT 0,
  bonus_vision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.ia_quotas TO authenticated;
GRANT ALL ON public.ia_quotas TO service_role;
ALTER TABLE public.ia_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Couple lit ses quotas" ON public.ia_quotas FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins modifient les quotas" ON public.ia_quotas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.ia_budget_mois (
  mois text PRIMARY KEY,
  total_eur numeric(12,6) NOT NULL DEFAULT 0,
  nb_appels integer NOT NULL DEFAULT 0,
  alerte_envoyee_le timestamptz,
  suspension_levee_le timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.ia_budget_mois TO authenticated;
GRANT ALL ON public.ia_budget_mois TO service_role;
ALTER TABLE public.ia_budget_mois ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins lisent ia_budget_mois" ON public.ia_budget_mois FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins modifient ia_budget_mois" ON public.ia_budget_mois FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE OR REPLACE FUNCTION public.trg_ia_logs_maj_budget()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.ia_budget_mois (mois, total_eur, nb_appels)
  VALUES (to_char(NEW.created_at AT TIME ZONE 'Europe/Paris','YYYY-MM'), COALESCE(NEW.cout_eur,0), 1)
  ON CONFLICT (mois) DO UPDATE SET
    total_eur = ia_budget_mois.total_eur + EXCLUDED.total_eur,
    nb_appels = ia_budget_mois.nb_appels + 1,
    updated_at = now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_ia_logs_after_insert_budget AFTER INSERT ON public.ia_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_ia_logs_maj_budget();

-- Réservation atomique : vérifie et incrémente en une seule instruction.
CREATE OR REPLACE FUNCTION public.reserver_quota_ia(p_user_id uuid, p_usage text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_q jsonb := COALESCE((SELECT valeur FROM ia_reglages WHERE cle='quotas_defaut'), '{}');
  v_jour date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_ok uuid;
BEGIN
  INSERT INTO ia_quotas (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  -- remise à zéro quotidienne (minuit Paris)
  UPDATE ia_quotas SET jour = v_jour, assistant_jour = 0, filtres_jour = 0, updated_at = now()
   WHERE user_id = p_user_id AND jour < v_jour;
  IF p_usage = 'assistant' THEN
    UPDATE ia_quotas SET assistant_jour = assistant_jour + 1, updated_at = now()
     WHERE user_id = p_user_id AND assistant_jour < COALESCE((v_q->>'assistant_par_jour')::int,0) + bonus_assistant RETURNING user_id INTO v_ok;
  ELSIF p_usage = 'filtres' THEN
    UPDATE ia_quotas SET filtres_jour = filtres_jour + 1, updated_at = now()
     WHERE user_id = p_user_id AND filtres_jour < COALESCE((v_q->>'filtres_par_jour')::int,0) + bonus_filtres RETURNING user_id INTO v_ok;
  ELSIF p_usage = 'livret' THEN
    UPDATE ia_quotas SET livret_total = livret_total + 1, updated_at = now()
     WHERE user_id = p_user_id AND livret_total < COALESCE((v_q->>'livret_total')::int,0) + bonus_livret RETURNING user_id INTO v_ok;
  ELSIF p_usage = 'charte' THEN
    UPDATE ia_quotas SET charte_total = charte_total + 1, updated_at = now()
     WHERE user_id = p_user_id AND charte_total < COALESCE((v_q->>'charte_total')::int,0) + bonus_charte RETURNING user_id INTO v_ok;
  ELSIF p_usage = 'vision' THEN
    UPDATE ia_quotas SET vision_total = vision_total + 1, updated_at = now()
     WHERE user_id = p_user_id AND vision_total < COALESCE((v_q->>'vision_total')::int,0) + bonus_vision RETURNING user_id INTO v_ok;
  ELSE
    RAISE EXCEPTION 'usage inconnu %', p_usage;
  END IF;
  RETURN v_ok IS NOT NULL;
END $$;

CREATE OR REPLACE FUNCTION public.annuler_quota_ia(p_user_id uuid, p_usage text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE ia_quotas SET
    assistant_jour = CASE WHEN p_usage='assistant' THEN GREATEST(assistant_jour-1,0) ELSE assistant_jour END,
    filtres_jour   = CASE WHEN p_usage='filtres'   THEN GREATEST(filtres_jour-1,0)   ELSE filtres_jour END,
    livret_total   = CASE WHEN p_usage='livret'    THEN GREATEST(livret_total-1,0)   ELSE livret_total END,
    charte_total   = CASE WHEN p_usage='charte'    THEN GREATEST(charte_total-1,0)   ELSE charte_total END,
    vision_total   = CASE WHEN p_usage='vision'    THEN GREATEST(vision_total-1,0)   ELSE vision_total END,
    updated_at = now()
  WHERE user_id = p_user_id;
END $$;

REVOKE ALL ON FUNCTION public.reserver_quota_ia(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.annuler_quota_ia(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserver_quota_ia(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.annuler_quota_ia(uuid,text) TO service_role;