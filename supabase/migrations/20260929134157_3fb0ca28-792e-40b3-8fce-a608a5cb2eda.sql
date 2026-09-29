DROP VIEW public.prestataires_public;
CREATE VIEW public.prestataires_public AS
 SELECT p.id, p.nom_commercial, p.slug, p.description, p.description_courte, p.prix_depart, p.prix_max,
    p.categorie_mere_id, p.categorie_fille_id, p.adresse, p.ville, p.code_postal, p.region, p.latitude, p.longitude,
    p.site_web, (p.telephone IS NOT NULL AND btrim(p.telephone) <> '') AS a_telephone,
    p.urls_galerie, p.photo_principale_url, p.video_url, p.tags, p.champs_specifiques, p.statut,
    p.date_premiere_publication, p.est_premium, p.est_verifie,
    p.note_qualite_prestation, p.note_professionnalisme, p.note_rapport_qualite_prix, p.note_flexibilite,
    p.note_moyenne, p.nombre_avis, p.nombre_demandes, p.metadonnees_seo, p.created_at, p.updated_at,
    p.zones_intervention, p.url_tiktok, p.url_instagram, p.url_facebook, p.url_pinterest,
    score_classement_bruite(p.id, p.score_classement) AS score_tri,
    COALESCE(v.videos_json, '[]'::jsonb) AS videos_json
   FROM prestataires p
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('id', pv.id, 'url_video', pv.url_video, 'url_thumbnail', pv.url_thumbnail, 'duree_seconds', pv.duree_seconds, 'ordre_affichage', pv.ordre_affichage) ORDER BY pv.ordre_affichage, pv.created_at) AS videos_json
           FROM prestataires_videos pv WHERE pv.prestataire_id = p.id) v ON true
  WHERE p.statut = 'actif'::statut_prestataire;
GRANT SELECT ON public.prestataires_public TO anon, authenticated;
GRANT ALL ON public.prestataires_public TO service_role;

CREATE OR REPLACE FUNCTION public.obtenir_telephone_prestataire(p_prestataire_id uuid)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tel text;
BEGIN
  SELECT telephone INTO v_tel FROM public.prestataires
   WHERE id = p_prestataire_id AND statut = 'actif' AND telephone IS NOT NULL AND btrim(telephone) <> '';
  IF v_tel IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.evenements_prestataire (prestataire_id, type) VALUES (p_prestataire_id, 'affichage_telephone');
  RETURN v_tel;
END; $$;
REVOKE ALL ON FUNCTION public.obtenir_telephone_prestataire(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obtenir_telephone_prestataire(uuid) TO anon, authenticated, service_role;