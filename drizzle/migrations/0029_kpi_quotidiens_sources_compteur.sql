
-- 1. Vue publique sans nombre_demandes
DROP VIEW public.prestataires_public;
CREATE VIEW public.prestataires_public AS
 SELECT p.id, p.nom_commercial, p.slug, p.description, p.description_courte, p.prix_depart, p.prix_max,
    p.categorie_mere_id, p.categorie_fille_id, p.adresse, p.ville, p.code_postal, p.region, p.latitude, p.longitude,
    p.site_web, ((p.telephone IS NOT NULL) AND (btrim(p.telephone) <> ''::text)) AS a_telephone,
    p.urls_galerie, p.photo_principale_url, p.video_url, p.tags, p.champs_specifiques, p.statut,
    p.date_premiere_publication, p.est_premium, p.est_verifie, p.note_qualite_prestation, p.note_professionnalisme,
    p.note_rapport_qualite_prix, p.note_flexibilite, p.note_moyenne, p.nombre_avis, p.metadonnees_seo,
    p.created_at, p.updated_at, p.zones_intervention, p.url_tiktok, p.url_instagram, p.url_facebook, p.url_pinterest,
    public.score_classement_bruite(p.id, p.score_classement) AS score_tri,
    COALESCE(v.videos_json, '[]'::jsonb) AS videos_json
   FROM public.prestataires p
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('id', pv.id, 'url_video', pv.url_video, 'url_thumbnail', pv.url_thumbnail, 'duree_seconds', pv.duree_seconds, 'ordre_affichage', pv.ordre_affichage) ORDER BY pv.ordre_affichage, pv.created_at) AS videos_json
           FROM public.prestataires_videos pv WHERE pv.prestataire_id = p.id) v ON true
  WHERE p.statut = 'actif'::public.statut_prestataire;
GRANT SELECT ON public.prestataires_public TO anon, authenticated;
GRANT ALL ON public.prestataires_public TO service_role;

-- 2. Compteur nombre_demandes (demandes validées)
CREATE OR REPLACE FUNCTION public.recalculer_nombre_demandes(_prestataire_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.prestataires p
     SET nombre_demandes = (SELECT count(*) FROM public.demandes_devis d WHERE d.prestataire_id = _prestataire_id AND d.moderation = 'valide')
   WHERE p.id = _prestataire_id
     AND p.nombre_demandes IS DISTINCT FROM (SELECT count(*) FROM public.demandes_devis d WHERE d.prestataire_id = _prestataire_id AND d.moderation = 'valide');
$$;
REVOKE ALL ON FUNCTION public.recalculer_nombre_demandes(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_nombre_demandes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.prestataire_id IS NOT NULL THEN
    PERFORM public.recalculer_nombre_demandes(NEW.prestataire_id);
  END IF;
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.prestataire_id IS NOT NULL
     AND (TG_OP = 'DELETE' OR OLD.prestataire_id IS DISTINCT FROM NEW.prestataire_id) THEN
    PERFORM public.recalculer_nombre_demandes(OLD.prestataire_id);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_nombre_demandes
AFTER INSERT OR DELETE OR UPDATE OF moderation, prestataire_id ON public.demandes_devis
FOR EACH ROW EXECUTE FUNCTION public.trg_nombre_demandes();

SELECT public.recalculer_nombre_demandes(x.prestataire_id)
FROM (SELECT DISTINCT prestataire_id FROM public.demandes_devis WHERE prestataire_id IS NOT NULL) x;

-- 3. Source des conversions
ALTER TABLE public.demandes_devis
  ADD COLUMN source_utm_source text, ADD COLUMN source_utm_medium text, ADD COLUMN source_utm_campaign text,
  ADD COLUMN source_referrer_domaine text, ADD COLUMN source_gclid_present boolean, ADD COLUMN source_groupe text;
ALTER TABLE public.evenements_prestataire
  ADD COLUMN source_utm_source text, ADD COLUMN source_utm_medium text, ADD COLUMN source_utm_campaign text,
  ADD COLUMN source_referrer_domaine text, ADD COLUMN source_gclid_present boolean, ADD COLUMN source_groupe text;

CREATE OR REPLACE FUNCTION public.classer_source_conversion(_src text, _medium text, _ref text, _gclid boolean)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  s text := lower(coalesce(_src,'')); m text := lower(coalesce(_medium,'')); r text := lower(coalesce(_ref,''));
  payant boolean := coalesce(_gclid,false) OR m IN ('cpc','ppc','paid','paid_social','display');
BEGIN
  IF payant AND (coalesce(_gclid,false) OR s ~ 'google') THEN RETURN 'google_ads'; END IF;
  IF s ~ '(chatgpt|openai)' OR r ~ '(^|\.)(chatgpt\.com|openai\.com)$' THEN
    RETURN CASE WHEN payant THEN 'chatgpt_ads' ELSE 'chatgpt_organique' END; END IF;
  IF s ~ '^(facebook|instagram|fb|ig|meta)' OR r ~ '(^|\.)(facebook\.com|instagram\.com|fb\.com|fb\.me)$' THEN
    RETURN CASE WHEN payant THEN 'meta_ads' ELSE 'meta_organique' END; END IF;
  IF s ~ 'pinterest' OR r ~ '(^|\.)pinterest\.[a-z.]+$' OR r ~ '(^|\.)pin\.it$' THEN
    RETURN CASE WHEN payant THEN 'pinterest_ads' ELSE 'pinterest_organique' END; END IF;
  IF m IN ('email','e-mail','newsletter') OR r ~ '(^|\.)(mail\.google\.com|outlook\.(live|office)\.com|mail\.yahoo\.com|webmail\.[a-z.]+|mail\.[a-z.]+)$' THEN
    RETURN 'email'; END IF;
  IF NOT payant AND r ~ '(^|\.)(google|bing|duckduckgo|ecosia|qwant|yahoo)\.[a-z.]+$' THEN RETURN 'seo'; END IF;
  IF s = '' AND m = '' AND r = '' AND NOT payant THEN RETURN 'direct'; END IF;
  RETURN 'autre';
END $$;

CREATE OR REPLACE FUNCTION public._source_txt(_j jsonb, _k text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT nullif(left(lower(btrim(_j->>_k)), 100), '')
$$;

CREATE OR REPLACE FUNCTION public.trg_classer_source()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.source_gclid_present IS NOT NULL OR NEW.source_utm_source IS NOT NULL OR NEW.source_utm_medium IS NOT NULL OR NEW.source_referrer_domaine IS NOT NULL THEN
    NEW.source_groupe := public.classer_source_conversion(NEW.source_utm_source, NEW.source_utm_medium, NEW.source_referrer_domaine, NEW.source_gclid_present);
  ELSE
    NEW.source_groupe := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_classer_source BEFORE INSERT ON public.demandes_devis FOR EACH ROW EXECUTE FUNCTION public.trg_classer_source();
CREATE TRIGGER trg_classer_source BEFORE INSERT ON public.evenements_prestataire FOR EACH ROW EXECUTE FUNCTION public.trg_classer_source();

DROP FUNCTION public.soumettre_demande_devis(uuid, text, text, text, public.objet_demande, text, date, text, text, integer, text);
CREATE FUNCTION public.soumettre_demande_devis(p_prestataire_id uuid, p_nom text, p_email text, p_telephone text, p_objet public.objet_demande, p_message text, p_date_evenement date DEFAULT NULL::date, p_lieu_evenement text DEFAULT NULL::text, p_nombre_invites_rang text DEFAULT NULL::text, p_budget_indicatif integer DEFAULT NULL::integer, p_date_precision text DEFAULT NULL::text, p_source jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := lower(trim(p_email));
  v_contact_id uuid;
  v_demande_id uuid;
  v_moderation text;
  v_user_id uuid := auth.uid();
  v_precision text;
  v_aujourdhui_paris date;
  v_ref text := public._source_txt(p_source, 'referrer_domaine');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.prestataires WHERE id = p_prestataire_id AND statut = 'actif') THEN
    RAISE EXCEPTION 'Prestataire introuvable ou inactif';
  END IF;

  IF p_date_evenement IS NOT NULL THEN
    v_precision := COALESCE(p_date_precision, 'jour');
    IF v_precision NOT IN ('jour', 'mois') THEN
      RAISE EXCEPTION 'Précision de date invalide: % (attendu: jour ou mois)', v_precision;
    END IF;
    v_aujourdhui_paris := (timezone('Europe/Paris', now()))::date;
    IF v_precision = 'jour' AND p_date_evenement < v_aujourdhui_paris THEN
      RAISE EXCEPTION 'La date de l''événement ne peut pas être antérieure à aujourd''hui';
    ELSIF v_precision = 'mois' AND date_trunc('month', p_date_evenement)::date < date_trunc('month', v_aujourdhui_paris)::date THEN
      RAISE EXCEPTION 'Le mois de l''événement ne peut pas être antérieur au mois en cours';
    END IF;
  ELSE
    v_precision := NULL;
  END IF;

  IF v_ref IS NOT NULL AND v_ref !~ '^[a-z0-9.-]+$' THEN v_ref := NULL; END IF;

  SELECT id INTO v_contact_id FROM public.contacts_anonymes WHERE email = v_email LIMIT 1;
  IF v_contact_id IS NULL THEN
    INSERT INTO public.contacts_anonymes (email, prenom, telephone, origine_premiere, profile_id)
    VALUES (v_email, split_part(p_nom, ' ', 1), p_telephone, 'fiche_prestataire', v_user_id)
    RETURNING id INTO v_contact_id;
  ELSE
    UPDATE public.contacts_anonymes
    SET telephone = COALESCE(p_telephone, telephone), profile_id = COALESCE(profile_id, v_user_id), updated_at = now()
    WHERE id = v_contact_id;
  END IF;

  INSERT INTO public.demandes_devis (
    prestataire_id, contact_id, profile_id, nom_contact, email_contact, telephone_contact,
    objet, date_evenement, date_precision, lieu_evenement, nombre_invites_rang, message, budget_indicatif,
    source_utm_source, source_utm_medium, source_utm_campaign, source_referrer_domaine, source_gclid_present
  ) VALUES (
    p_prestataire_id, v_contact_id, v_user_id, p_nom, v_email, p_telephone,
    p_objet, p_date_evenement, v_precision, p_lieu_evenement, p_nombre_invites_rang, p_message, p_budget_indicatif,
    public._source_txt(p_source,'utm_source'), public._source_txt(p_source,'utm_medium'), public._source_txt(p_source,'utm_campaign'),
    v_ref, CASE WHEN p_source IS NULL THEN NULL ELSE coalesce((p_source->>'gclid_present')::boolean, false) END
  )
  RETURNING id, moderation INTO v_demande_id, v_moderation;

  RETURN jsonb_build_object('demande_id', v_demande_id, 'moderation', v_moderation);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.soumettre_demande_devis(uuid, text, text, text, public.objet_demande, text, date, text, text, integer, text, jsonb) TO anon, authenticated, service_role;

DROP FUNCTION public.obtenir_telephone_prestataire(uuid);
CREATE FUNCTION public.obtenir_telephone_prestataire(p_prestataire_id uuid, p_source jsonb DEFAULT NULL::jsonb)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_tel text; v_ref text := public._source_txt(p_source, 'referrer_domaine');
BEGIN
  SELECT telephone INTO v_tel FROM public.prestataires
   WHERE id = p_prestataire_id AND statut = 'actif' AND telephone IS NOT NULL AND btrim(telephone) <> '';
  IF v_tel IS NULL THEN RETURN NULL; END IF;
  IF v_ref IS NOT NULL AND v_ref !~ '^[a-z0-9.-]+$' THEN v_ref := NULL; END IF;
  INSERT INTO public.evenements_prestataire (prestataire_id, type, source_utm_source, source_utm_medium, source_utm_campaign, source_referrer_domaine, source_gclid_present)
  VALUES (p_prestataire_id, 'affichage_telephone',
    public._source_txt(p_source,'utm_source'), public._source_txt(p_source,'utm_medium'), public._source_txt(p_source,'utm_campaign'),
    v_ref, CASE WHEN p_source IS NULL THEN NULL ELSE coalesce((p_source->>'gclid_present')::boolean, false) END);
  RETURN v_tel;
END; $function$;
GRANT EXECUTE ON FUNCTION public.obtenir_telephone_prestataire(uuid, jsonb) TO anon, authenticated, service_role;

-- 4. Fiches de test exclues des KPI
CREATE TABLE public.kpi_fiches_test (
  prestataire_id uuid PRIMARY KEY REFERENCES public.prestataires(id) ON DELETE CASCADE,
  motif text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_fiches_test TO authenticated;
GRANT ALL ON public.kpi_fiches_test TO service_role;
ALTER TABLE public.kpi_fiches_test ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gèrent les fiches de test" ON public.kpi_fiches_test FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
INSERT INTO public.kpi_fiches_test (prestataire_id, motif) VALUES
 ('5950ba2e-1a80-4ccc-b483-bcdc1e35bf86','Studio Rodolphe Photo'),
 ('ff6da00f-0dd3-4354-b5d7-3015187c9864','Rodolphe Photo'),
 ('c2fc7c41-528f-493f-a985-727bc0ede73a','Test Nathalie 1'),
 ('ceeea9c7-c246-43a4-803c-3dcb7a5afaf6','Carole Wedding Planner'),
 ('83d0b10b-8814-4c71-a36d-395dff4cefb8','Margaux Décoration'),
 ('e69fcc05-8077-48e2-876e-3f9072d220d8','Augustin Voitures de Prestige');

-- 5. Indicateurs quotidiens
CREATE OR REPLACE FUNCTION public.get_kpi_quotidiens(p_date date, p_inclure_photo boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d0 timestamptz := (p_date::timestamp AT TIME ZONE 'Europe/Paris');
  d1 timestamptz := ((p_date + 1)::timestamp AT TIME ZONE 'Europe/Paris');
  debut_sources date := DATE '2026-11-24';
  r jsonb; src jsonb := '{}'::jsonb; g text;
  groupes text[] := ARRAY['google_ads','chatgpt_ads','chatgpt_organique','meta_ads','meta_organique','pinterest_ads','pinterest_organique','email','seo','direct','autre'];
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _kpi_test_users ON COMMIT DROP AS SELECT id FROM public.profiles WHERE email ~* '@lesnoces\.test$';

  r := jsonb_build_object(
    'demandes_devis_valides', (SELECT count(*) FROM demandes_devis d WHERE d.created_at >= d0 AND d.created_at < d1 AND d.moderation='valide'
        AND d.prestataire_id NOT IN (SELECT prestataire_id FROM kpi_fiches_test)
        AND coalesce(d.profile_id,'00000000-0000-0000-0000-000000000000') NOT IN (SELECT id FROM _kpi_test_users)
        AND d.email_contact !~* '@lesnoces\.test$'),
    'demandes_devis_rejetees', (SELECT count(*) FROM demandes_devis d WHERE d.created_at >= d0 AND d.created_at < d1 AND d.moderation='rejete'
        AND d.prestataire_id NOT IN (SELECT prestataire_id FROM kpi_fiches_test)
        AND coalesce(d.profile_id,'00000000-0000-0000-0000-000000000000') NOT IN (SELECT id FROM _kpi_test_users)
        AND d.email_contact !~* '@lesnoces\.test$'),
    'affichages_telephone', (SELECT count(*) FROM evenements_prestataire e WHERE e.type='affichage_telephone' AND e.created_at >= d0 AND e.created_at < d1
        AND e.prestataire_id NOT IN (SELECT prestataire_id FROM kpi_fiches_test)),
    'visites_fiches', (SELECT count(*) FROM evenements_prestataire e WHERE e.type='vue_profil' AND e.created_at >= d0 AND e.created_at < d1
        AND e.prestataire_id NOT IN (SELECT prestataire_id FROM kpi_fiches_test)),
    'fiches_vues_distinctes', (SELECT count(DISTINCT e.prestataire_id) FROM evenements_prestataire e WHERE e.type='vue_profil' AND e.created_at >= d0 AND e.created_at < d1
        AND e.prestataire_id NOT IN (SELECT prestataire_id FROM kpi_fiches_test)),
    'comptes_couples_crees', (SELECT count(*) FROM profiles pr JOIN user_roles ur ON ur.user_id=pr.id AND ur.role='client'
        WHERE pr.created_at >= d0 AND pr.created_at < d1 AND pr.id NOT IN (SELECT id FROM _kpi_test_users)),
    'favoris_ajoutes', (SELECT count(*) FROM favoris f WHERE f.created_at >= d0 AND f.created_at < d1
        AND f.user_id NOT IN (SELECT id FROM _kpi_test_users) AND f.prestataire_id NOT IN (SELECT prestataire_id FROM kpi_fiches_test)),
    'consentements_marketing_couples', (SELECT count(*) FROM profiles pr JOIN user_roles ur ON ur.user_id=pr.id AND ur.role='client'
        WHERE pr.consentement_marketing IS TRUE AND pr.consentement_marketing_le >= d0 AND pr.consentement_marketing_le < d1
        AND pr.id NOT IN (SELECT id FROM _kpi_test_users)),
    'articles_publies', (SELECT count(*) FROM articles_blog a WHERE a.est_publie AND coalesce(a.publie_le, a.created_at) < d1),
    'atelier_couples_actifs_7j', (SELECT count(DISTINCT l.user_id) FROM ia_logs l WHERE l.user_id IS NOT NULL
        AND l.created_at >= d1 - interval '7 days' AND l.created_at < d1 AND l.user_id NOT IN (SELECT id FROM _kpi_test_users)
        AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id=l.user_id AND ur.role IN ('admin','super_admin'))),
    'atelier_cout_ia_jour', (SELECT round(coalesce(sum(l.cout_eur),0)::numeric, 4) FROM ia_logs l WHERE l.created_at >= d0 AND l.created_at < d1
        AND coalesce(l.user_id,'00000000-0000-0000-0000-000000000000') NOT IN (SELECT id FROM _kpi_test_users))
  );

  FOREACH g IN ARRAY groupes LOOP
    IF p_date >= debut_sources THEN
      src := src || jsonb_build_object(
        'demandes_valides_' || g, (SELECT count(*) FROM demandes_devis d WHERE d.created_at >= d0 AND d.created_at < d1 AND d.moderation='valide'
            AND coalesce(d.source_groupe,'direct') = g
            AND d.prestataire_id NOT IN (SELECT prestataire_id FROM kpi_fiches_test) AND d.email_contact !~* '@lesnoces\.test$'),
        'affichages_telephone_' || g, (SELECT count(*) FROM evenements_prestataire e WHERE e.type='affichage_telephone' AND e.created_at >= d0 AND e.created_at < d1
            AND coalesce(e.source_groupe,'direct') = g AND e.prestataire_id NOT IN (SELECT prestataire_id FROM kpi_fiches_test)));
    ELSE
      src := src || jsonb_build_object('demandes_valides_' || g, NULL, 'affichages_telephone_' || g, NULL);
    END IF;
  END LOOP;
  r := r || src;

  IF p_inclure_photo THEN
    r := r || (
      WITH f AS (
        SELECT p.*, ((p.photo_principale_url IS NOT NULL)::int + coalesce(cardinality(p.urls_galerie),0)) AS nb_photos,
               coalesce(length(p.description),0) AS lg
        FROM prestataires p WHERE p.id NOT IN (SELECT prestataire_id FROM kpi_fiches_test)
      )
      SELECT jsonb_build_object(
        'fiches_actives', count(*) FILTER (WHERE statut='actif'),
        'fiches_correctes', count(*) FILTER (WHERE statut='actif' AND nb_photos>=3 AND lg>=300),
        'fiches_completes', count(*) FILTER (WHERE statut='actif' AND nb_photos>=6 AND lg>=300 AND prix_depart IS NOT NULL),
        'fiches_avec_prix', count(*) FILTER (WHERE statut='actif' AND prix_depart IS NOT NULL),
        'fiches_avec_6_photos', count(*) FILTER (WHERE statut='actif' AND nb_photos>=6),
        'fiches_avec_avis', count(*) FILTER (WHERE statut='actif' AND coalesce(nombre_avis,0)>0),
        'comptes_prestataires_actives', count(*) FILTER (WHERE compte_active_le IS NOT NULL),
        'prestataires_connectes_7j', count(*) FILTER (WHERE derniere_connexion_le >= d1 - interval '7 days'),
        'chartes_signees', count(*) FILTER (WHERE charte_signee_le IS NOT NULL),
        'suspendus', count(*) FILTER (WHERE statut='suspendu'),
        'score_classement_moyen', round(avg(score_classement) FILTER (WHERE statut='actif')::numeric, 2)
      ) FROM f)
    || (SELECT jsonb_build_object(
        'prestataires_en_essai', count(*) FILTER (WHERE a.statut='trialing'),
        'abonnes_payants_standard', count(*) FILTER (WHERE a.statut='actif' AND a.formule='standard'),
        'abonnes_payants_premium', count(*) FILTER (WHERE a.statut='actif' AND a.formule='premium'))
        FROM abonnements a WHERE a.prestataire_id NOT IN (SELECT prestataire_id FROM kpi_fiches_test))
    || (SELECT jsonb_build_object(
        'snapshots_a_jour', count(*) FILTER (WHERE statut='a_jour'),
        'snapshots_a_traiter', count(*) FILTER (WHERE statut='a_traiter'),
        'snapshots_abandonne', count(*) FILTER (WHERE statut='abandonne')) FROM prerender_queue)
    || jsonb_build_object('pages_indexables', (SELECT count(*) FROM public.prerender_pages_indexables()));
  END IF;

  DROP TABLE IF EXISTS _kpi_test_users;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.get_kpi_quotidiens(date, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_kpi_quotidiens(date, boolean) TO service_role;
