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

  -- Taux moyen de réponse plateforme, ramené sur [0,1]
  SELECT COALESCE(AVG(public.prestataires.taux_reponse) / 100.0, 0) INTO v_taux_moyen_plateforme
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

  -- Réactivité (taux déjà en pourcentage, normalisé sur [0,1])
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