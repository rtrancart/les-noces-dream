-- 1. Nouvelles colonnes
ALTER TABLE public.prestataires
  ADD COLUMN IF NOT EXISTS score_classement numeric(5,2),
  ADD COLUMN IF NOT EXISTS derniere_connexion_le timestamp with time zone;

-- 2. Index de tri
CREATE INDEX IF NOT EXISTS idx_prestataires_score_classement
  ON public.prestataires (statut, score_classement DESC, est_premium DESC, note_moyenne DESC);

-- 3. Fonction de calcul du score (sur une ligne prestataires)
CREATE OR REPLACE FUNCTION public.calculer_score_classement_for_row(p public.prestataires)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_avis_count int := 0;
  v_note_moyenne real := 0;
  v_c real := 0;
  v_age_score numeric := 0;

  v_photo_score numeric := 0;
  v_comp_weight int := 0;
  v_comp_sum numeric := 0;
  v_comp_score numeric := 0;

  v_react_active boolean := false;
  v_react_n int := 0;
  v_react_taux numeric := 0;
  v_taux_moyen_plateforme numeric := 0;
  v_react_score numeric := 0;

  v_fresh_score numeric := 0;
  v_date_ref timestamp with time zone;
  v_days numeric;

  v_w_avis numeric := 0.35;
  v_w_comp numeric := 0.25;
  v_w_react numeric := 0.20;
  v_w_fresh numeric := 0.10;
  v_w_age numeric := 0.05;
  v_active_sum numeric := 0;

  v_score numeric := 0;
  v_gal_count int := 0;
  v_has_main boolean := false;
  v_total_photos int := 0;
BEGIN
  -- Moyennes plateforme
  SELECT COALESCE(AVG(public.avis.note_globale), 0) INTO v_c
  FROM public.avis
  WHERE public.avis.statut = 'valide'::public.statut_avis;

  SELECT COALESCE(AVG(public.prestataires.taux_reponse), 0) INTO v_taux_moyen_plateforme
  FROM public.prestataires
  WHERE public.prestataires.taux_reponse IS NOT NULL
    AND COALESCE(public.prestataires.taux_reponse_nb_demandes_90j, 0) > 0;

  -- Avis validés du prestataire + âge moyen
  SELECT
    COUNT(*),
    COALESCE(AVG(public.avis.note_globale), 0),
    COALESCE(AVG(
      CASE
        WHEN EXTRACT(EPOCH FROM (now() - public.avis.created_at)) / 86400.0 <= 90 THEN 1.0
        WHEN EXTRACT(EPOCH FROM (now() - public.avis.created_at)) / 86400.0 >= 730 THEN 0.0
        ELSE 1.0 - (EXTRACT(EPOCH FROM (now() - public.avis.created_at)) / 86400.0 - 90.0) / 640.0
      END
    ), 0)
  INTO v_avis_count, v_note_moyenne, v_age_score
  FROM public.avis
  WHERE public.avis.prestataire_id = p.id
    AND public.avis.statut = 'valide'::public.statut_avis;

  -- Photos
  v_gal_count := COALESCE(array_length(p.urls_galerie, 1), 0);
  v_has_main := (p.photo_principale_url IS NOT NULL AND length(p.photo_principale_url) > 0);
  v_total_photos := v_gal_count + (CASE WHEN v_has_main THEN 1 ELSE 0 END);

  v_photo_score := CASE
    WHEN v_total_photos >= 10 THEN 1.0
    WHEN v_total_photos >= 6 THEN 0.85 + (v_total_photos - 6)::numeric / 4.0 * 0.15
    WHEN v_total_photos >= 3 THEN 0.6 + (v_total_photos - 3)::numeric / 3.0 * 0.25
    WHEN v_total_photos >= 1 THEN 0.3 + (v_total_photos - 1)::numeric / 2.0 * 0.3
    ELSE 0.0
  END;

  -- Complétude : poids forts (3)
  v_comp_weight := v_comp_weight + 3;
  v_comp_sum := v_comp_sum + 3 * (CASE WHEN p.description_courte IS NOT NULL AND length(p.description_courte) > 0 THEN 1.0 ELSE 0.0 END);

  v_comp_weight := v_comp_weight + 3;
  v_comp_sum := v_comp_sum + 3 * (CASE WHEN length(COALESCE(p.description, '')) >= 300 THEN 1.0 ELSE 0.0 END);

  v_comp_weight := v_comp_weight + 3;
  v_comp_sum := v_comp_sum + 3 * v_photo_score;

  -- Complétude : poids moyens (2)
  v_comp_weight := v_comp_weight + 2;
  v_comp_sum := v_comp_sum + 2 * (CASE WHEN COALESCE(array_length(p.zones_intervention, 1), 0) > 0 THEN 1.0 ELSE 0.0 END);

  v_comp_weight := v_comp_weight + 2;
  v_comp_sum := v_comp_sum + 2 * (CASE WHEN p.champs_specifiques IS NOT NULL AND p.champs_specifiques <> '{}'::jsonb AND p.champs_specifiques <> 'null'::jsonb THEN 1.0 ELSE 0.0 END);

  v_comp_weight := v_comp_weight + 2;
  v_comp_sum := v_comp_sum + 2 * (CASE WHEN p.prix_depart IS NOT NULL THEN 1.0 ELSE 0.0 END);

  -- Complétude : poids faibles (1)
  v_comp_weight := v_comp_weight + 1;
  v_comp_sum := v_comp_sum + 1 * (CASE WHEN p.telephone IS NOT NULL AND length(p.telephone) > 0 THEN 1.0 ELSE 0.0 END);

  v_comp_weight := v_comp_weight + 1;
  v_comp_sum := v_comp_sum + 1 * (CASE WHEN p.email_contact IS NOT NULL AND length(p.email_contact) > 0 THEN 1.0 ELSE 0.0 END);

  v_comp_weight := v_comp_weight + 1;
  v_comp_sum := v_comp_sum + 1 * (CASE WHEN p.site_web IS NOT NULL AND length(p.site_web) > 0 THEN 1.0 ELSE 0.0 END);

  v_comp_weight := v_comp_weight + 1;
  v_comp_sum := v_comp_sum + 1 * (CASE WHEN p.adresse IS NOT NULL AND length(p.adresse) > 0 AND p.code_postal IS NOT NULL AND length(p.code_postal) > 0 THEN 1.0 ELSE 0.0 END);

  v_comp_weight := v_comp_weight + 1;
  v_comp_sum := v_comp_sum + 1 * (CASE WHEN p.latitude IS NOT NULL AND p.longitude IS NOT NULL THEN 1.0 ELSE 0.0 END);

  v_comp_weight := v_comp_weight + 1;
  v_comp_sum := v_comp_sum + 1 * (CASE WHEN p.categorie_fille_id IS NOT NULL THEN 1.0 ELSE 0.0 END);

  v_comp_score := v_comp_sum / NULLIF(v_comp_weight, 0);

  -- Réactivité
  v_react_n := COALESCE(p.taux_reponse_nb_demandes_90j, 0);
  v_react_active := (v_react_n > 0 AND p.taux_reponse IS NOT NULL);
  IF v_react_active THEN
    v_react_taux := p.taux_reponse / 100.0;
    v_react_score := (v_react_n * v_react_taux + 3 * v_taux_moyen_plateforme) / (v_react_n + 3);
  END IF;

  -- Fraîcheur
  v_date_ref := greatest(
    COALESCE(p.derniere_connexion_le, '1970-01-01'::timestamptz),
    COALESCE(p.updated_at, '1970-01-01'::timestamptz),
    COALESCE(p.premier_login_le, '1970-01-01'::timestamptz),
    COALESCE(p.date_premiere_publication, '1970-01-01'::timestamptz)
  );
  v_days := EXTRACT(EPOCH FROM (now() - v_date_ref)) / 86400.0;
  v_fresh_score := CASE
    WHEN v_days <= 30 THEN 1.0
    WHEN v_days >= 365 THEN 0.0
    ELSE 1.0 - (v_days - 30.0) / 335.0
  END;

  -- Pondération dynamique
  v_active_sum := v_w_comp + v_w_fresh;
  IF v_avis_count > 0 THEN
    v_active_sum := v_active_sum + v_w_avis + v_w_age;
  END IF;
  IF v_react_active THEN
    v_active_sum := v_active_sum + v_w_react;
  END IF;

  IF v_active_sum = 0 THEN
    RETURN 0;
  END IF;

  v_score := (v_w_comp / v_active_sum) * v_comp_score
           + (v_w_fresh / v_active_sum) * v_fresh_score;

  IF v_avis_count > 0 THEN
    v_score := v_score
             + (v_w_avis / v_active_sum) * (((v_avis_count::numeric / (v_avis_count + 5)) * v_note_moyenne + (5::numeric / (v_avis_count + 5)) * v_c) / 5.0)
             + (v_w_age / v_active_sum) * v_age_score;
  END IF;

  IF v_react_active THEN
    v_score := v_score + (v_w_react / v_active_sum) * v_react_score;
  END IF;

  RETURN ROUND(v_score * 100, 2);
END;
$function$;

-- 4. Fonction publique par ID
CREATE OR REPLACE FUNCTION public.calculer_score_classement(p_prestataire_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT public.calculer_score_classement_for_row(p)
  FROM public.prestataires p
  WHERE p.id = p_prestataire_id;
$function$;

-- 5. Fonction de bruit déterministe pour le tri (STABLE pour rotation quotidienne)
CREATE OR REPLACE FUNCTION public.score_classement_bruite(p_id uuid, p_score numeric)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT CASE
    WHEN p_score IS NULL THEN NULL
    ELSE p_score + 2.5 * (2 * ((hashtext(concat(p_id::text, current_date::text))::numeric + 2147483648) / 4294967295) - 1)
  END;
$function$;

-- 6. Batch de recalcul
CREATE OR REPLACE FUNCTION public.recalculer_tous_les_scores(p_limit int default null, p_offset int default 0)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_count int := 0;
  v_id uuid;
  v_new numeric;
BEGIN
  FOR v_id IN
    SELECT p.id
    FROM public.prestataires p
    ORDER BY p.id
    LIMIT COALESCE(p_limit, 1000000000)
    OFFSET COALESCE(p_offset, 0)
  LOOP
    v_new := public.calculer_score_classement(v_id);
    UPDATE public.prestataires
    SET score_classement = v_new
    WHERE id = v_id
      AND score_classement IS DISTINCT FROM v_new;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$function$;

-- 7. RPC de dernière connexion (throttle 24h, sécurisé par auth.uid())
CREATE OR REPLACE FUNCTION public.marquer_derniere_connexion(p_prestataire_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF p_prestataire_id IS NULL OR auth.uid() IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.prestataires
  SET derniere_connexion_le = now()
  WHERE id = p_prestataire_id
    AND user_id = auth.uid()
    AND (
      derniere_connexion_le IS NULL
      OR derniere_connexion_le < now() - interval '24 hours'
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.marquer_derniere_connexion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculer_score_classement(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculer_score_classement_for_row(public.prestataires) TO authenticated;
GRANT EXECUTE ON FUNCTION public.score_classement_bruite(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.score_classement_bruite(uuid, numeric) TO anon;

-- 8. Triggers
CREATE OR REPLACE FUNCTION public.trg_score_avis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_prestataire_id uuid;
  v_new numeric;
BEGIN
  v_prestataire_id := COALESCE(NEW.prestataire_id, OLD.prestataire_id);
  IF v_prestataire_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_new := public.calculer_score_classement(v_prestataire_id);
  UPDATE public.prestataires
  SET score_classement = v_new
  WHERE id = v_prestataire_id
    AND score_classement IS DISTINCT FROM v_new;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_score_avis ON public.avis;
CREATE TRIGGER trg_score_avis
  AFTER INSERT OR UPDATE OF statut, note_globale OR DELETE
  ON public.avis
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_score_avis();

CREATE OR REPLACE FUNCTION public.trg_score_prestataires()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.score_classement := public.calculer_score_classement_for_row(NEW);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_score_prestataires ON public.prestataires;
CREATE TRIGGER trg_score_prestataires
  BEFORE UPDATE OF description_courte, description, photo_principale_url, urls_galerie,
                   telephone, email_contact, site_web, adresse, code_postal,
                   latitude, longitude, zones_intervention, champs_specifiques,
                   categorie_fille_id, prix_depart, prix_max,
                   taux_reponse, taux_reponse_nb_demandes_90j, derniere_connexion_le,
                   updated_at
  ON public.prestataires
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_score_prestataires();

CREATE OR REPLACE FUNCTION public.trg_score_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_prestataire_id uuid;
  v_new numeric;
BEGIN
  SELECT dd.prestataire_id INTO v_prestataire_id
  FROM public.demandes_devis dd
  WHERE dd.id = NEW.demande_id;

  IF v_prestataire_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_new := public.calculer_score_classement(v_prestataire_id);
  UPDATE public.prestataires
  SET score_classement = v_new
  WHERE id = v_prestataire_id
    AND score_classement IS DISTINCT FROM v_new;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_score_messages ON public.messages;
CREATE TRIGGER trg_score_messages
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_score_messages();

CREATE OR REPLACE FUNCTION public.trg_score_demandes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_new numeric;
BEGIN
  v_new := public.calculer_score_classement(NEW.prestataire_id);
  UPDATE public.prestataires
  SET score_classement = v_new
  WHERE id = NEW.prestataire_id
    AND score_classement IS DISTINCT FROM v_new;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_score_demandes ON public.demandes_devis;
CREATE TRIGGER trg_score_demandes
  AFTER INSERT ON public.demandes_devis
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_score_demandes();

-- 9. Vue publique recréée avec score_classement et score_tri
DROP VIEW IF EXISTS public.prestataires_public;

CREATE VIEW public.prestataires_public AS
SELECT
  p.id,
  p.user_id,
  p.nom_commercial,
  p.slug,
  p.description,
  p.description_courte,
  p.prix_depart,
  p.prix_max,
  p.categorie_mere_id,
  p.categorie_fille_id,
  p.adresse,
  p.ville,
  p.code_postal,
  p.region,
  p.latitude,
  p.longitude,
  p.site_web,
  p.telephone,
  p.email_contact,
  p.urls_galerie,
  p.photo_principale_url,
  p.video_url,
  p.tags,
  p.champs_specifiques,
  p.statut,
  p.date_premiere_publication,
  p.est_premium,
  p.est_verifie,
  p.fin_visibilite_boost,
  p.note_qualite_prestation,
  p.note_professionnalisme,
  p.note_rapport_qualite_prix,
  p.note_flexibilite,
  p.note_moyenne,
  p.nombre_avis,
  p.nombre_demandes,
  p.metadonnees_seo,
  p.cree_par_admin,
  p.created_at,
  p.updated_at,
  p.zones_intervention,
  p.fin_premium,
  p.charte_version_signee,
  p.premier_login_le,
  p.demande_reactivation_le,
  p.url_tiktok,
  p.url_instagram,
  p.url_facebook,
  p.url_pinterest,
  p.derniere_connexion_le,
  p.score_classement,
  public.score_classement_bruite(p.id, p.score_classement) AS score_tri,
  COALESCE(v.videos_json, '[]'::jsonb) AS videos_json
FROM public.prestataires p
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', pv.id,
      'url_video', pv.url_video,
      'url_thumbnail', pv.url_thumbnail,
      'duree_seconds', pv.duree_seconds,
      'ordre_affichage', pv.ordre_affichage
    ) ORDER BY pv.ordre_affichage, pv.created_at
  ) AS videos_json
  FROM public.prestataires_videos pv
  WHERE pv.prestataire_id = p.id
) v ON true
WHERE p.statut = 'actif'::public.statut_prestataire;

-- 10. Cron nocturne
SELECT cron.unschedule('recalcul-scores-nightly') FROM cron.job WHERE jobname = 'recalcul-scores-nightly';
SELECT cron.schedule(
  'recalcul-scores-nightly',
  '20 3 * * *',
  $$SELECT public.recalculer_tous_les_scores();$$
);