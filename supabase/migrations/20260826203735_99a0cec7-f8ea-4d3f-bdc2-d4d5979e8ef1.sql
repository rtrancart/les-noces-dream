-- Recensement unique des pages indexables + empreinte du contenu visible.
-- Source de vérité partagée par le sitemap et la réconciliation de pré-rendu.
CREATE OR REPLACE FUNCTION public.prerender_pages_indexables()
RETURNS TABLE(url_path text, page_type text, source_id uuid, signature text, lastmod timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH avis_agg AS (
  SELECT a.prestataire_id,
         md5(string_agg(
           coalesce(a.titre,'') || '|' || coalesce(a.commentaire,'') || '|' ||
           a.note_globale::text || '|' || coalesce(a.reponse_prestataire,''),
           '~' ORDER BY a.created_at DESC, a.id)) AS h
  FROM public.avis a
  WHERE a.statut = 'valide'
  GROUP BY a.prestataire_id
),
presta AS (
  SELECT * FROM public.prestataires WHERE statut = 'actif'
),
cats AS (
  SELECT * FROM public.categories WHERE est_active
),
presta_par_mere AS (
  SELECT p.categorie_mere_id AS cid,
         md5(string_agg(
           p.slug || '|' || p.nom_commercial || '|' || coalesce(p.description_courte,'') || '|' ||
           coalesce(p.ville,'') || '|' || coalesce(p.region,'') || '|' ||
           coalesce(p.photo_principale_url,'') || '|' || coalesce(p.note_moyenne::text,'') || '|' ||
           coalesce(p.nombre_avis::text,'') || '|' || coalesce(p.prix_depart::text,'') || '|' ||
           coalesce(p.est_premium::text,''),
           '~' ORDER BY p.slug)) AS h
  FROM presta p GROUP BY p.categorie_mere_id
),
presta_par_fille AS (
  SELECT p.categorie_fille_id AS cid,
         md5(string_agg(
           p.slug || '|' || p.nom_commercial || '|' || coalesce(p.description_courte,'') || '|' ||
           coalesce(p.ville,'') || '|' || coalesce(p.region,'') || '|' ||
           coalesce(p.photo_principale_url,'') || '|' || coalesce(p.note_moyenne::text,'') || '|' ||
           coalesce(p.nombre_avis::text,'') || '|' || coalesce(p.prix_depart::text,'') || '|' ||
           coalesce(p.est_premium::text,''),
           '~' ORDER BY p.slug)) AS h
  FROM presta p WHERE p.categorie_fille_id IS NOT NULL GROUP BY p.categorie_fille_id
),
filles_par_mere AS (
  SELECT c.parent_id AS cid,
         md5(string_agg(c.slug || '|' || c.nom, '~' ORDER BY c.ordre_affichage, c.slug)) AS h
  FROM cats c WHERE c.parent_id IS NOT NULL GROUP BY c.parent_id
),
champs_par_cat AS (
  SELECT cc.categorie_id AS cid,
         md5(string_agg(cc.cle || '|' || cc.label || '|' || cc.type_champ::text,
                        '~' ORDER BY cc.ordre_affichage, cc.cle)) AS h
  FROM public.champs_categories cc WHERE cc.visible_public GROUP BY cc.categorie_id
),
articles_pub AS (
  SELECT * FROM public.articles_blog
  WHERE est_publie AND coalesce(noindex,false) = false AND coalesce(inclure_sitemap,true) = true
),
-- 1. Pages statiques indexables (accueil + index blog).
statiques AS (
  SELECT '/'::text AS url_path, 'statique'::text AS page_type, NULL::uuid AS source_id,
         md5(coalesce((SELECT string_agg(c.slug || '|' || c.nom || '|' || coalesce(c.photo_url,'') || '|' || coalesce(c.icone_url,''),
                       '~' ORDER BY c.ordre_affichage, c.slug) FROM cats c WHERE c.parent_id IS NULL), '')) AS signature,
         (SELECT max(c.updated_at) FROM cats c) AS lastmod
  UNION ALL
  SELECT '/blog', 'statique', NULL::uuid,
         md5(coalesce((SELECT string_agg(a.slug || '|' || a.titre || '|' || coalesce(a.extrait,'') || '|' || coalesce(a.image_couverture_url,''),
                       '~' ORDER BY a.publie_le DESC NULLS LAST, a.slug) FROM articles_pub a), '')),
         (SELECT max(a.updated_at) FROM articles_pub a)
),
-- 2. Régions publiées.
regions AS (
  SELECT '/mariage/' || r.slug_region, 'region', r.id,
         md5(concat_ws('|', r.nom_region, coalesce(r.intro_editoriale,''), r.specificites::text,
             r.conseils::text, r.faq::text, coalesce(r.citation_llm,''),
             coalesce(r.budget_moyen::text,''), coalesce(r.budget_min::text,''), coalesce(r.budget_max::text,''),
             coalesce(r.meilleure_periode,''), coalesce(r.delai_reservation,''),
             coalesce(r.contenu_seo_bas,''), coalesce(r.image_hero_url,''),
             coalesce(r.meta_title,''), coalesce(r.meta_description,''))),
         r.updated_at
  FROM public.pages_regions_mariage r WHERE r.est_publiee
),
-- 3. Catégories mères.
cat_meres AS (
  SELECT '/prestataires/' || c.slug, 'categorie', c.id,
         md5(concat_ws('|', c.nom, c.slug, coalesce(c.description_seo,''), coalesce(c.contenu_seo,''),
             coalesce(c.photo_url,''), coalesce(c.icone_url,''),
             coalesce(fm.h,''), coalesce(pm.h,''))),
         c.updated_at
  FROM cats c
  LEFT JOIN filles_par_mere fm ON fm.cid = c.id
  LEFT JOIN presta_par_mere pm ON pm.cid = c.id
  WHERE c.parent_id IS NULL
),
-- 4. Catégories filles.
cat_filles AS (
  SELECT '/prestataires/' || m.slug || '/' || c.slug, 'categorie_fille', c.id,
         md5(concat_ws('|', c.nom, c.slug, coalesce(c.description_seo,''), coalesce(c.contenu_seo,''),
             coalesce(c.photo_url,''), coalesce(c.icone_url,''), coalesce(pf.h,''))),
         c.updated_at
  FROM cats c
  JOIN cats m ON m.id = c.parent_id AND m.parent_id IS NULL
  LEFT JOIN presta_par_fille pf ON pf.cid = c.id
  WHERE c.parent_id IS NOT NULL
),
-- 5. Articles de blog publiés et indexables.
arts AS (
  SELECT '/blog/' || a.slug, 'article_blog', a.id,
         md5(concat_ws('|', a.titre, coalesce(a.extrait,''), coalesce(a.contenu,''),
             coalesce(a.image_couverture_url,''), coalesce(a.legende_image,''),
             coalesce(a.auteur,''), coalesce(a.temps_lecture::text,''),
             coalesce(a.categorie_blog,''), coalesce(array_to_string(a.tags,','),''),
             a.faq::text, coalesce(a.meta_title,''), coalesce(a.meta_description,''),
             coalesce(a.publie_le::text,''))),
         a.updated_at
  FROM articles_pub a
),
-- 6. Pages éditoriales publiées (dont pages légales).
pages_edito AS (
  SELECT '/' || pc.slug, 'page_contenu', pc.id,
         md5(concat_ws('|', pc.titre, pc.slug, coalesce(pc.contenu,''),
             coalesce(pc.meta_title,''), coalesce(pc.meta_description,''))),
         pc.updated_at
  FROM public.pages_contenu pc WHERE pc.est_publiee
),
-- 7. Fiches prestataires actives.
fiches AS (
  SELECT '/prestataire/' || p.slug, 'prestataire', p.id,
         md5(concat_ws('|', p.nom_commercial, coalesce(p.description,''), coalesce(p.description_courte,''),
             coalesce(p.prix_depart::text,''), coalesce(p.prix_max::text,''),
             coalesce(p.ville,''), coalesce(p.code_postal,''), coalesce(p.adresse,''), coalesce(p.region,''),
             coalesce(array_to_string(p.zones_intervention,','),''),
             coalesce(p.photo_principale_url,''), coalesce(array_to_string(p.urls_galerie,','),''),
             coalesce(p.video_url,''), coalesce(p.site_web,''), coalesce(p.telephone,''),
             coalesce(array_to_string(p.tags,','),''), coalesce(p.champs_specifiques::text,''),
             coalesce(p.latitude::text,''), coalesce(p.longitude::text,''),
             coalesce(p.note_moyenne::text,''), coalesce(p.note_qualite_prestation::text,''),
             coalesce(p.note_professionnalisme::text,''), coalesce(p.note_rapport_qualite_prix::text,''),
             coalesce(p.note_flexibilite::text,''), coalesce(p.nombre_avis::text,''),
             coalesce(p.est_premium::text,''), coalesce(p.est_verifie::text,''),
             coalesce(cm.slug,''), coalesce(cm.nom,''), coalesce(cf.slug,''), coalesce(cf.nom,''),
             coalesce(aa.h,''), coalesce(ch.h,''))),
         p.updated_at
  FROM presta p
  LEFT JOIN public.categories cm ON cm.id = p.categorie_mere_id
  LEFT JOIN public.categories cf ON cf.id = p.categorie_fille_id
  LEFT JOIN avis_agg aa ON aa.prestataire_id = p.id
  LEFT JOIN champs_par_cat ch ON ch.cid = p.categorie_mere_id
)
SELECT * FROM statiques
UNION ALL SELECT * FROM regions
UNION ALL SELECT * FROM cat_meres
UNION ALL SELECT * FROM cat_filles
UNION ALL SELECT * FROM arts
UNION ALL SELECT * FROM pages_edito
UNION ALL SELECT * FROM fiches;
$$;

REVOKE ALL ON FUNCTION public.prerender_pages_indexables() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prerender_pages_indexables() TO service_role;

-- Synchronisation par tranches de la file de pré-rendu.
CREATE OR REPLACE FUNCTION public.prerender_reconcilier(p_limit integer DEFAULT 1000, p_offset integer DEFAULT 0)
RETURNS TABLE(traitees integer, ajoutees integer, remises integer, inchangees integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer := 0;
  v_ajout integer := 0;
  v_remise integer := 0;
BEGIN
  CREATE TEMP TABLE _pi ON COMMIT DROP AS
    SELECT * FROM public.prerender_pages_indexables()
    ORDER BY url_path
    OFFSET greatest(p_offset, 0) LIMIT greatest(p_limit, 1);

  SELECT count(*) INTO v_total FROM _pi;

  WITH ins AS (
    INSERT INTO public.prerender_queue (url_path, page_type, source_id, signature_visible, statut)
    SELECT pi.url_path, pi.page_type, pi.source_id, pi.signature, 'a_traiter' FROM _pi pi
    ON CONFLICT (url_path) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_ajout FROM ins;

  WITH upd AS (
    UPDATE public.prerender_queue q
    SET signature_visible = pi.signature,
        page_type = pi.page_type,
        source_id = pi.source_id,
        statut = 'a_traiter',
        tentatives = 0,
        dernier_motif = NULL,
        dernier_status = NULL,
        updated_at = now()
    FROM _pi pi
    WHERE q.url_path = pi.url_path
      AND q.signature_visible IS DISTINCT FROM pi.signature
    RETURNING 1
  ) SELECT count(*) INTO v_remise FROM upd;

  RETURN QUERY SELECT v_total, v_ajout, v_remise, v_total - v_ajout - v_remise;
END;
$$;

REVOKE ALL ON FUNCTION public.prerender_reconcilier(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prerender_reconcilier(integer, integer) TO service_role;

-- Entrées de la file qui ne correspondent plus à aucune page indexable.
CREATE OR REPLACE FUNCTION public.prerender_orphelins(p_limit integer DEFAULT 100)
RETURNS TABLE(id uuid, url_path text, storage_path text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH pi AS MATERIALIZED (SELECT p.url_path FROM public.prerender_pages_indexables() p)
  SELECT q.id, q.url_path, q.storage_path
  FROM public.prerender_queue q
  WHERE NOT EXISTS (SELECT 1 FROM pi WHERE pi.url_path = q.url_path)
  ORDER BY q.url_path
  LIMIT greatest(p_limit, 1);
$$;

REVOKE ALL ON FUNCTION public.prerender_orphelins(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prerender_orphelins(integer) TO service_role;

-- Statistiques : sert de garde-fou avant toute purge.
CREATE OR REPLACE FUNCTION public.prerender_stats()
RETURNS TABLE(total_file bigint, total_indexables bigint, total_orphelins bigint, total_a_traiter bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH pi AS MATERIALIZED (SELECT p.url_path FROM public.prerender_pages_indexables() p)
  SELECT (SELECT count(*) FROM public.prerender_queue),
         (SELECT count(*) FROM pi),
         (SELECT count(*) FROM public.prerender_queue q WHERE NOT EXISTS (SELECT 1 FROM pi WHERE pi.url_path = q.url_path)),
         (SELECT count(*) FROM public.prerender_queue WHERE statut = 'a_traiter');
$$;

REVOKE ALL ON FUNCTION public.prerender_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prerender_stats() TO service_role;