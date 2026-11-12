DROP FUNCTION IF EXISTS public.rechercher_prestataires(text, text, text[], extensions.vector, numeric, integer);

CREATE OR REPLACE FUNCTION public.mots_significatifs(p text)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public, extensions AS $$
  SELECT COALESCE(array_agg(DISTINCT m), '{}') FROM regexp_split_to_table(lower(immutable_unaccent(COALESCE(p,''))), '[^a-z0-9]+') m
  WHERE length(m) >= 3 AND m NOT IN ('les','des','une','pour','avec','sans','sur','aux','par','dans','est','qui','que','nous','vous','son','ses','leur','leurs','mais','tres','plus','tout','tous','toute','toutes','the','and','mariage','style','pas','ete','sont','cette','ces','notre','nos','votre','vos','entre','aussi','bien','comme')
$$;

CREATE OR REPLACE FUNCTION public.libelle_zone_courte(p_zi text[])
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_parts text[] := '{}'; v_deps text[]; v_n int;
BEGIN
  IF p_zi IS NULL OR cardinality(p_zi) = 0 THEN RETURN NULL; END IF;
  IF 'france_entiere' = ANY(p_zi) THEN RETURN 'France entière'; END IF;
  v_parts := v_parts || COALESCE((SELECT array_agg(label ORDER BY label) FROM zones_reference WHERE type IN ('region','pays') AND zone_value = ANY(p_zi)), '{}');
  SELECT array_agg(COALESCE(label, z) ORDER BY z) INTO v_deps
    FROM unnest(p_zi) z LEFT JOIN zones_reference r ON r.type IN ('departement','dom') AND r.zone_value = z
   WHERE NOT EXISTS (SELECT 1 FROM zones_reference x WHERE x.type IN ('region','pays') AND x.zone_value = z)
     AND NOT EXISTS (SELECT 1 FROM zones_reference x WHERE x.type IN ('departement','dom') AND x.zone_value = z AND x.parent_region_zone_value = ANY(p_zi));
  v_n := COALESCE(cardinality(v_deps), 0);
  IF v_n > 0 THEN
    v_parts := v_parts || v_deps[1:5];
  END IF;
  RETURN array_to_string(v_parts, ', ') || CASE WHEN v_n > 5 THEN ' et ' || (v_n - 5) || ' autres' ELSE '' END;
END $$;

-- Champs envoyés à l'IA : usage_ia = true + infos pratiques (paiement, acompte, capacité, déplacement)
CREATE OR REPLACE FUNCTION public.formater_champs_specifiques_ia(p_champs jsonb, p_cat_mere uuid, p_cat_fille uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(string_agg(lib || ' : ' || val, ' | ' ORDER BY lib), '')
  FROM (
    SELECT c.label AS lib,
           CASE jsonb_typeof(e.value)
             WHEN 'array' THEN (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(e.value) x WHERE btrim(x) <> '')
             WHEN 'boolean' THEN CASE WHEN e.value = 'true'::jsonb THEN 'Oui' ELSE 'Non' END
             WHEN 'null' THEN NULL
             ELSE e.value #>> '{}' END AS val
    FROM jsonb_each(COALESCE(p_champs, '{}'::jsonb)) e
    JOIN LATERAL (SELECT cc.label, cc.usage_ia FROM champs_categories cc
                   WHERE cc.cle = e.key AND (cc.categorie_id IS NULL OR cc.categorie_id IN (p_cat_mere, p_cat_fille))
                   ORDER BY CASE WHEN cc.categorie_id = p_cat_fille THEN 1 WHEN cc.categorie_id = p_cat_mere THEN 2 ELSE 3 END
                   LIMIT 1) c ON true
    WHERE c.usage_ia IS TRUE
       OR e.key IN ('moyens_de_paiement_acceptes','acompte_demande_a_la_reservation','montant_de_l_acompte','frais_de_deplacement')
       OR e.key LIKE 'capacite%'
  ) s
  WHERE val IS NOT NULL AND btrim(val) <> ''
$$;

CREATE OR REPLACE FUNCTION public.rechercher_prestataires(
  p_categorie text DEFAULT NULL,
  p_sous_categorie text DEFAULT NULL,
  p_departements text[] DEFAULT NULL,
  p_embedding_intention extensions.vector DEFAULT NULL,
  p_budget_max_eur numeric DEFAULT NULL,
  p_limite integer DEFAULT 10,
  p_intention_texte text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_reg jsonb := (SELECT valeur FROM ia_reglages WHERE cle = 'poids_recherche_ia');
  w_pert numeric := COALESCE((v_reg->>'pertinence')::numeric, 0.8);
  w_score numeric := COALESCE((v_reg->>'score_classement')::numeric, 0.2);
  w_tag numeric := COALESCE((v_reg->>'bonus_etiquette')::numeric, 0.03);
  w_tag_max numeric := COALESCE((v_reg->>'bonus_etiquettes_max')::numeric, 0.09);
  v_mots text[] := mots_significatifs(p_intention_texte);
  v_cat uuid;
  v_deps text[] := COALESCE(p_departements, '{}');
  v_avec_zone boolean := COALESCE(array_length(p_departements,1),0) > 0;
  v_regions text[];
  v_lim int := LEAST(GREATEST(COALESCE(p_limite,10),1),20);
  v_res jsonb;
BEGIN
  IF p_embedding_intention IS NULL THEN
    RETURN jsonb_build_object('erreur','intention_manquante');
  END IF;
  IF p_categorie IS NOT NULL AND btrim(p_categorie) <> '' THEN
    SELECT id INTO v_cat FROM categories
     WHERE parent_id IS NULL AND COALESCE(est_active,true)
       AND (lower(immutable_unaccent(nom)) = lower(immutable_unaccent(btrim(p_categorie))) OR slug = lower(btrim(p_categorie)))
     LIMIT 1;
    IF v_cat IS NULL THEN
      RETURN jsonb_build_object('erreur','categorie_inconnue',
        'message','Cette catégorie n''existe pas. Relance la recherche avec une des catégories valides.',
        'categories_valides', (SELECT jsonb_agg(nom ORDER BY nom) FROM categories WHERE parent_id IS NULL AND COALESCE(est_active,true)));
    END IF;
  END IF;
  IF v_avec_zone THEN
    SELECT array_agg(DISTINCT parent_region_zone_value) INTO v_regions FROM zones_reference
     WHERE type = 'departement' AND parent_region_zone_value IS NOT NULL
       AND (dept_code = ANY(v_deps) OR zone_value = ANY(v_deps));
  END IF;
  v_regions := COALESCE(v_regions, '{}');

  WITH eligibles AS (
    SELECT p.id, p.score_classement, p.categorie_mere_id, p.categorie_fille_id,
           departement_depuis_cp(p.code_postal) AS dep,
           (1 - (p.embedding <=> p_embedding_intention))::numeric AS sim,
           CASE WHEN p_sous_categorie IS NOT NULL AND btrim(p_sous_categorie) <> ''
                 AND lower(immutable_unaccent(COALESCE(cf.nom,''))) = lower(immutable_unaccent(btrim(p_sous_categorie)))
                THEN 0.05 ELSE 0 END AS bonus,
           p.zones_intervention AS zi,
           (SELECT count(*) FROM unnest(COALESCE(p.tags_ia,'{}')) t
             WHERE COALESCE(array_length(v_mots,1),0) > 0 AND mots_significatifs(t) && v_mots)::int AS nb_tags
      FROM prestataires p
      LEFT JOIN categories cf ON cf.id = p.categorie_fille_id
     WHERE p.statut = 'actif' AND p.embedding IS NOT NULL
       AND (v_cat IS NULL OR p.categorie_mere_id = v_cat)
       AND (p_budget_max_eur IS NULL OR p.prix_depart IS NULL OR p.prix_depart <= p_budget_max_eur)
  ),
  marques AS (
    SELECT e.*, e.sim + e.bonus + LEAST(e.nb_tags * w_tag, w_tag_max) AS pert_brute,
      (NOT v_avec_zone
        OR e.dep = ANY(v_deps)
        OR COALESCE(e.zi,'{}') && v_deps
        OR COALESCE(e.zi,'{}') && v_regions
        OR 'france_entiere' = ANY(COALESCE(e.zi,'{}'))) AS en_zone,
      EXISTS (SELECT 1 FROM zones_reference z WHERE z.type='departement' AND z.dept_code = e.dep
               AND z.parent_region_zone_value = ANY(v_regions)) AS meme_region
    FROM eligibles e
  ),
  top_zone AS (
    SELECT * FROM marques WHERE en_zone ORDER BY pert_brute DESC LIMIT 30
  ),
  norm_zone AS (
    SELECT t.*, false AS hors_zone,
      CASE WHEN max(pert_brute) OVER () = min(pert_brute) OVER () THEN 1
           ELSE (pert_brute - min(pert_brute) OVER ()) / (max(pert_brute) OVER () - min(pert_brute) OVER ()) END AS pert_norm
    FROM top_zone t
  ),
  final_zone AS (
    SELECT n.*, w_pert * n.pert_norm + CASE WHEN n.score_classement IS NULL THEN 0 ELSE w_score * n.score_classement / 100 END AS score_final
    FROM norm_zone n ORDER BY score_final DESC LIMIT v_lim
  ),
  manque AS (SELECT v_lim - count(*) AS n FROM final_zone),
  top_hors AS (
    SELECT m.* FROM marques m WHERE v_avec_zone AND NOT m.en_zone AND (SELECT n FROM manque) > 0
    ORDER BY m.meme_region DESC, m.pert_brute DESC LIMIT 30
  ),
  norm_hors AS (
    SELECT t.*, true AS hors_zone,
      CASE WHEN max(pert_brute) OVER () = min(pert_brute) OVER () THEN 1
           ELSE (pert_brute - min(pert_brute) OVER ()) / (max(pert_brute) OVER () - min(pert_brute) OVER ()) END AS pert_norm
    FROM top_hors t
  ),
  final_hors AS (
    SELECT n.*, w_pert * n.pert_norm + CASE WHEN n.score_classement IS NULL THEN 0 ELSE w_score * n.score_classement / 100 END AS score_final
    FROM norm_hors n ORDER BY n.meme_region DESC, score_final DESC LIMIT (SELECT GREATEST(n,0) FROM manque)
  ),
  retenus AS (
    SELECT *, row_number() OVER (ORDER BY score_final DESC) AS rang FROM final_zone
    UNION ALL
    SELECT *, 1000 + row_number() OVER (ORDER BY meme_region DESC, score_final DESC) FROM final_hors
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'nom_commercial', p.nom_commercial,
      'url', 'https://lesnoces.net/prestataires/' || p.slug,
      'photo_principale', p.photo_principale_url,
      'categorie', cm.nom,
      'sous_categorie', cf.nom,
      'ville', p.ville,
      'departement', r.dep,
      'zone', libelle_zone_courte(p.zones_intervention),
      'prix_depart', p.prix_depart,
      'description_courte', p.description_courte,
      'description', left(COALESCE(p.description,''), 1000),
      'champs_specifiques', formater_champs_specifiques_ia(p.champs_specifiques, p.categorie_mere_id, p.categorie_fille_id),
      'tags_ia', p.tags_ia,
      'note_moyenne', (SELECT round(avg(a.note_globale)::numeric,1) FROM avis a WHERE a.prestataire_id = p.id AND a.statut = 'valide'),
      'nombre_avis', (SELECT count(*) FROM avis a WHERE a.prestataire_id = p.id AND a.statut = 'valide'),
      'hors_zone', r.hors_zone,
      'meme_region', r.meme_region,
      'sim_brute', round(r.sim, 4),
      'etiquettes_trouvees', r.nb_tags,
      'pertinence_norm', round(r.pert_norm, 4),
      'score_classement', r.score_classement,
      'score', round(r.score_final, 4)
    ) ORDER BY r.rang), '[]'::jsonb)
  INTO v_res
  FROM retenus r
  JOIN prestataires p ON p.id = r.id
  LEFT JOIN categories cm ON cm.id = p.categorie_mere_id
  LEFT JOIN categories cf ON cf.id = p.categorie_fille_id;

  RETURN jsonb_build_object('resultats', v_res);
END $$;

REVOKE EXECUTE ON FUNCTION public.rechercher_prestataires(text, text, text[], extensions.vector, numeric, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rechercher_prestataires(text, text, text[], extensions.vector, numeric, integer, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.libelle_zone_courte(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.libelle_zone_courte(text[]) TO service_role;
REVOKE EXECUTE ON FUNCTION public.formater_champs_specifiques_ia(jsonb, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.formater_champs_specifiques_ia(jsonb, uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.mots_significatifs(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mots_significatifs(text) TO service_role;