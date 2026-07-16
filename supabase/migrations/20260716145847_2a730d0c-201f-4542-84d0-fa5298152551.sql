
-- 1) Vue miroir de prestataires_public, SANS filtre statut.
--    Verrouillée : aucun rôle client ne peut lire directement.
--    Seule la RPC SECURITY DEFINER get_prestataire_preview[_by_id] la lit.

CREATE OR REPLACE VIEW public.prestataires_public_all AS
  SELECT
    id, user_id, nom_commercial, slug, description, description_courte,
    prix_depart, prix_max, categorie_mere_id, categorie_fille_id,
    adresse, ville, code_postal, region, latitude, longitude,
    site_web, telephone, email_contact, urls_galerie, photo_principale_url,
    video_url, tags, champs_specifiques, statut, date_premiere_publication,
    est_premium, est_verifie, fin_visibilite_boost,
    note_qualite_prestation, note_professionnalisme, note_rapport_qualite_prix,
    note_flexibilite, note_moyenne, nombre_avis, nombre_demandes,
    metadonnees_seo, cree_par_admin, created_at, updated_at,
    zones_intervention, fin_premium, charte_version_signee, premier_login_le,
    demande_reactivation_le
  FROM public.prestataires;

-- Fermeture stricte : aucun accès direct via PostgREST/SQL client.
REVOKE ALL ON public.prestataires_public_all FROM PUBLIC;
REVOKE ALL ON public.prestataires_public_all FROM anon, authenticated;

-- 2) RPC de preview par slug — contrôle d'accès explicite.

CREATE OR REPLACE FUNCTION public.get_prestataire_preview(p_slug text)
RETURNS SETOF public.prestataires_public_all
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT user_id INTO v_owner
    FROM public.prestataires
   WHERE slug = p_slug
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF public.has_role(v_uid, 'admin'::public.app_role)
     OR public.has_role(v_uid, 'super_admin'::public.app_role)
     OR v_owner = v_uid THEN
    RETURN QUERY
      SELECT * FROM public.prestataires_public_all
       WHERE slug = p_slug;
  ELSE
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_prestataire_preview(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_prestataire_preview(text) TO authenticated;

-- 3) RPC de preview par id — robustesse (fiche sans slug, liens admin par UUID).

CREATE OR REPLACE FUNCTION public.get_prestataire_preview_by_id(p_id uuid)
RETURNS SETOF public.prestataires_public_all
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT user_id INTO v_owner
    FROM public.prestataires
   WHERE id = p_id
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF public.has_role(v_uid, 'admin'::public.app_role)
     OR public.has_role(v_uid, 'super_admin'::public.app_role)
     OR v_owner = v_uid THEN
    RETURN QUERY
      SELECT * FROM public.prestataires_public_all
       WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_prestataire_preview_by_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_prestataire_preview_by_id(uuid) TO authenticated;
