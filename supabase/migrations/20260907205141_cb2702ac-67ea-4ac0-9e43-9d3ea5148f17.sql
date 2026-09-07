CREATE TABLE public.prestataires_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestataire_id uuid NOT NULL REFERENCES public.prestataires(id) ON DELETE CASCADE,
  url_video text NOT NULL,
  url_thumbnail text,
  duree_seconds integer,
  taille_bytes bigint,
  ordre_affichage integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.prestataires_videos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prestataires_videos TO authenticated;
GRANT ALL ON public.prestataires_videos TO service_role;

ALTER TABLE public.prestataires_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view prestataires videos rows"
ON public.prestataires_videos FOR SELECT
USING (true);

CREATE POLICY "Owner or admin can insert videos"
ON public.prestataires_videos FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.prestataires p WHERE p.id = prestataire_id AND p.user_id = auth.uid())
);

CREATE POLICY "Owner or admin can update videos"
ON public.prestataires_videos FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.prestataires p WHERE p.id = prestataire_id AND p.user_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.prestataires p WHERE p.id = prestataire_id AND p.user_id = auth.uid())
);

CREATE POLICY "Owner or admin can delete videos"
ON public.prestataires_videos FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.prestataires p WHERE p.id = prestataire_id AND p.user_id = auth.uid())
);

CREATE INDEX idx_prestataires_videos_ordre
  ON public.prestataires_videos (prestataire_id, ordre_affichage);

CREATE OR REPLACE FUNCTION public.check_limite_videos_selon_formule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_premium boolean;
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.prestataires_videos v
  WHERE v.prestataire_id = NEW.prestataire_id;

  IF v_count >= 10 THEN
    RAISE EXCEPTION 'Limite de 10 vidéos atteinte pour cette fiche';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.abonnements a
    WHERE a.prestataire_id = NEW.prestataire_id
      AND a.formule = 'premium'::public.formule_abonnement
      AND a.statut = 'actif'::public.statut_abonnement
  ) INTO v_premium;

  IF NOT v_premium THEN
    RAISE EXCEPTION 'Les vidéos sont réservées aux fiches disposant d''un abonnement Premium actif';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_limite_videos
BEFORE INSERT ON public.prestataires_videos
FOR EACH ROW EXECUTE FUNCTION public.check_limite_videos_selon_formule();

CREATE TRIGGER trg_updated_at_videos
BEFORE UPDATE ON public.prestataires_videos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE VIEW public.prestataires_public AS
SELECT p.id,
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
    coalesce(v.videos_json, '[]'::jsonb) AS videos_json
   FROM public.prestataires p
   LEFT JOIN LATERAL (
     SELECT jsonb_agg(jsonb_build_object(
              'id', pv.id,
              'url_video', pv.url_video,
              'url_thumbnail', pv.url_thumbnail,
              'duree_seconds', pv.duree_seconds,
              'ordre_affichage', pv.ordre_affichage
            ) ORDER BY pv.ordre_affichage, pv.created_at) AS videos_json
     FROM public.prestataires_videos pv
     WHERE pv.prestataire_id = p.id
   ) v ON true
  WHERE p.statut = 'actif'::statut_prestataire;

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
             coalesce(fm.h,''), coalesce(pm.h,''))),
         c.updated_at
  FROM cats c
  LEFT JOIN filles_par_mere fm ON fm.cid = c.id
  LEFT JOIN presta_par_mere pm ON pm.cid = c.id
  WHERE c.parent_id IS NULL
),
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
$$;

REVOKE ALL ON FUNCTION public.prerender_pages_indexables() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prerender_pages_indexables() TO service_role;