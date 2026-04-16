CREATE OR REPLACE FUNCTION public.soumettre_demande_devis(
  p_prestataire_id uuid,
  p_nom text,
  p_email text,
  p_telephone text,
  p_objet objet_demande,
  p_message text,
  p_date_evenement date DEFAULT NULL,
  p_lieu_evenement text DEFAULT NULL,
  p_nombre_invites_rang text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_contact_id uuid;
  v_demande_id uuid;
  v_user_id uuid := auth.uid();
BEGIN
  -- Validate prestataire exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.prestataires
    WHERE id = p_prestataire_id AND statut = 'actif'
  ) THEN
    RAISE EXCEPTION 'Prestataire introuvable ou inactif';
  END IF;

  -- Find or create contact
  SELECT id INTO v_contact_id
  FROM public.contacts_anonymes
  WHERE email = v_email
  LIMIT 1;

  IF v_contact_id IS NULL THEN
    INSERT INTO public.contacts_anonymes (email, prenom, telephone, origine_premiere, profile_id)
    VALUES (
      v_email,
      split_part(p_nom, ' ', 1),
      p_telephone,
      'fiche_prestataire',
      v_user_id
    )
    RETURNING id INTO v_contact_id;
  ELSE
    -- Refresh phone/profile_id if missing
    UPDATE public.contacts_anonymes
    SET
      telephone = COALESCE(p_telephone, telephone),
      profile_id = COALESCE(profile_id, v_user_id),
      updated_at = now()
    WHERE id = v_contact_id;
  END IF;

  -- Insert quote request
  INSERT INTO public.demandes_devis (
    prestataire_id, contact_id, profile_id,
    nom_contact, email_contact, telephone_contact,
    objet, date_evenement, lieu_evenement, nombre_invites_rang, message
  ) VALUES (
    p_prestataire_id, v_contact_id, v_user_id,
    p_nom, v_email, p_telephone,
    p_objet, p_date_evenement, p_lieu_evenement, p_nombre_invites_rang, p_message
  )
  RETURNING id INTO v_demande_id;

  RETURN v_demande_id;
END;
$$;

-- Allow anonymous and authenticated users to call this function
GRANT EXECUTE ON FUNCTION public.soumettre_demande_devis(uuid, text, text, text, objet_demande, text, date, text, text) TO anon, authenticated;