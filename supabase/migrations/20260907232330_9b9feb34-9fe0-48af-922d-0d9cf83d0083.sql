CREATE OR REPLACE VIEW public.prestataires_public_all AS
 SELECT id, user_id, nom_commercial, slug, description, description_courte, prix_depart, prix_max,
    categorie_mere_id, categorie_fille_id, adresse, ville, code_postal, region, latitude, longitude,
    site_web, telephone, email_contact, urls_galerie, photo_principale_url, video_url, tags,
    champs_specifiques, statut, date_premiere_publication, est_premium, est_verifie,
    fin_visibilite_boost, note_qualite_prestation, note_professionnalisme, note_rapport_qualite_prix,
    note_flexibilite, note_moyenne, nombre_avis, nombre_demandes, metadonnees_seo, cree_par_admin,
    created_at, updated_at, zones_intervention, fin_premium, charte_version_signee, premier_login_le,
    demande_reactivation_le, url_tiktok, url_instagram, url_facebook, url_pinterest
   FROM prestataires;