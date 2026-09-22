CREATE OR REPLACE FUNCTION public.prerender_pages_indexables()
 RETURNS TABLE(url_path text, page_type text, source_id uuid, signature text, lastmod timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
videos_agg AS (
  SELECT v.prestataire_id,
         md5(string_agg(v.url_video || '|' || coalesce(v.url_thumbnail,''),
                        '~' ORDER BY v.ordre_affichage, v.created_at)) AS h
  FROM public.prestataires_videos v
  GROUP BY v.prestataire_id
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
articles_par_cat AS (
  SELECT a.categorie_liee_slug AS cslug,
         md5(string_agg(a.slug || '|' || a.titre || '|' || coalesce(a.extrait,''),
                        '~' ORDER BY a.publie_le DESC NULLS LAST, a.slug)) AS h
  FROM articles_pub a
  WHERE a.categorie_liee_slug IS NOT NULL
  GROUP BY a.categorie_liee_slug
),
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
cat_meres AS (
  SELECT '/prestataires/' || c.slug, 'categorie', c.id,
         md5(concat_ws('|', c.nom, c.slug, coalesce(c.description_seo,''), coalesce(c.contenu_seo,''),
             coalesce(c.photo_url,''), coalesce(c.icone_url,''),
             coalesce(c.seo_intro,''), coalesce(c.seo_body,''), coalesce(c.faq::text,'[]'),
             coalesce(c.meta_title,''), coalesce(c.meta_description,''),
             coalesce(c.nom_singulier,''), coalesce(c.genre,''),
             coalesce(fm.h,''), coalesce(pm.h,''), coalesce(ac.h,''))),
         c.updated_at
  FROM cats c
  LEFT JOIN filles_par_mere fm ON fm.cid = c.id
  LEFT JOIN presta_par_mere pm ON pm.cid = c.id
  LEFT JOIN articles_par_cat ac ON ac.cslug = c.slug
  WHERE c.parent_id IS NULL
),
cat_filles AS (
  SELECT '/prestataires/' || m.slug || '/' || c.slug, 'categorie_fille', c.id,
         md5(concat_ws('|', c.nom, c.slug, coalesce(c.description_seo,''), coalesce(c.contenu_seo,''),
             coalesce(c.photo_url,''), coalesce(c.icone_url,''),
             coalesce(c.seo_intro,''), coalesce(c.seo_body,''), coalesce(c.faq::text,'[]'),
             coalesce(c.meta_title,''), coalesce(c.meta_description,''),
             coalesce(c.nom_singulier,''), coalesce(c.genre,''),
             coalesce(pf.h,''), coalesce(ac.h,''))),
         c.updated_at
  FROM cats c
  JOIN cats m ON m.id = c.parent_id AND m.parent_id IS NULL
  LEFT JOIN presta_par_fille pf ON pf.cid = c.id
  LEFT JOIN articles_par_cat ac ON ac.cslug = c.slug
  WHERE c.parent_id IS NOT NULL
),
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
pages_edito AS (
  SELECT '/' || pc.slug, 'page_contenu', pc.id,
         md5(concat_ws('|', pc.titre, pc.slug, coalesce(pc.contenu,''),
             coalesce(pc.meta_title,''), coalesce(pc.meta_description,''))),
         pc.updated_at
  FROM public.pages_contenu pc WHERE pc.est_publiee
),
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
             coalesce(p.url_tiktok,''), coalesce(p.url_instagram,''),
             coalesce(p.url_facebook,''), coalesce(p.url_pinterest,''),
             coalesce(vv.h,''),
             coalesce(cm.slug,''), coalesce(cm.nom,''), coalesce(cf.slug,''), coalesce(cf.nom,''),
             coalesce(aa.h,''), coalesce(ch.h,''))),
         p.updated_at
  FROM presta p
  LEFT JOIN public.categories cm ON cm.id = p.categorie_mere_id
  LEFT JOIN public.categories cf ON cf.id = p.categorie_fille_id
  LEFT JOIN avis_agg aa ON aa.prestataire_id = p.id
  LEFT JOIN videos_agg vv ON vv.prestataire_id = p.id
  LEFT JOIN champs_par_cat ch ON ch.cid = p.categorie_mere_id
)
SELECT * FROM statiques
UNION ALL SELECT * FROM regions
UNION ALL SELECT * FROM cat_meres
UNION ALL SELECT * FROM cat_filles
UNION ALL SELECT * FROM arts
UNION ALL SELECT * FROM pages_edito
UNION ALL SELECT * FROM fiches;
$function$;