DROP FUNCTION IF EXISTS public.soumettre_avis(uuid, smallint, smallint, smallint, smallint, text, text, text);

CREATE OR REPLACE FUNCTION public.soumettre_avis(
  p_prestataire_id uuid,
  p_note_qualite_presta smallint,
  p_note_professionnalisme smallint,
  p_note_rapport_qualite_prix smallint,
  p_note_flexibilite smallint,
  p_titre text,
  p_commentaire text,
  p_nom text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_contact_id uuid;
  v_client_id uuid;
  v_avis_id uuid;
  v_note_globale real;
  v_comment text := trim(coalesce(p_commentaire, ''));
  v_titre text := trim(coalesce(p_titre, ''));
BEGIN
  IF p_note_qualite_presta NOT BETWEEN 1 AND 5
     OR p_note_professionnalisme NOT BETWEEN 1 AND 5
     OR p_note_rapport_qualite_prix NOT BETWEEN 1 AND 5
     OR p_note_flexibilite NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Notes invalides (1 à 5)';
  END IF;

  IF length(v_titre) < 3 OR length(v_titre) > 120 THEN
    RAISE EXCEPTION 'Titre requis (3 à 120 caractères)';
  END IF;

  IF length(v_comment) = 0 OR length(v_comment) > 2000 THEN
    RAISE EXCEPTION 'Commentaire requis (max 2000 caractères)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.prestataires WHERE id = p_prestataire_id AND statut = 'actif') THEN
    RAISE EXCEPTION 'Prestataire introuvable ou inactif';
  END IF;

  IF v_user_id IS NOT NULL THEN
    v_client_id := v_user_id;

    IF EXISTS (SELECT 1 FROM public.prestataires WHERE id = p_prestataire_id AND user_id = v_user_id) THEN
      RAISE EXCEPTION 'Vous ne pouvez pas laisser d''avis sur votre propre fiche';
    END IF;

    IF EXISTS (SELECT 1 FROM public.avis WHERE client_id = v_user_id AND prestataire_id = p_prestataire_id) THEN
      RAISE EXCEPTION 'Vous avez déjà déposé un avis pour ce prestataire';
    END IF;
  ELSE
    IF length(coalesce(trim(p_nom), '')) < 2 THEN
      RAISE EXCEPTION 'Nom requis';
    END IF;
    IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
      RAISE EXCEPTION 'Email invalide';
    END IF;

    SELECT id INTO v_contact_id FROM public.contacts_anonymes WHERE email = v_email LIMIT 1;
    IF v_contact_id IS NULL THEN
      INSERT INTO public.contacts_anonymes (email, prenom, origine_premiere)
      VALUES (v_email, split_part(trim(p_nom), ' ', 1), 'avis_fiche')
      RETURNING id INTO v_contact_id;
    END IF;

    IF EXISTS (SELECT 1 FROM public.avis WHERE contact_id = v_contact_id AND prestataire_id = p_prestataire_id) THEN
      RAISE EXCEPTION 'Un avis a déjà été déposé avec cet email pour ce prestataire';
    END IF;
  END IF;

  v_note_globale := (p_note_qualite_presta * 2 + p_note_professionnalisme + p_note_rapport_qualite_prix + p_note_flexibilite)::real / 5.0;

  INSERT INTO public.avis (
    prestataire_id, client_id, contact_id,
    note_qualite_presta, note_professionnalisme, note_rapport_qualite_prix, note_flexibilite,
    note_globale, titre, commentaire, statut
  ) VALUES (
    p_prestataire_id, v_client_id, v_contact_id,
    p_note_qualite_presta, p_note_professionnalisme, p_note_rapport_qualite_prix, p_note_flexibilite,
    v_note_globale, v_titre, v_comment, 'en_attente'
  )
  RETURNING id INTO v_avis_id;

  RETURN v_avis_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.soumettre_avis(uuid, smallint, smallint, smallint, smallint, text, text, text, text) TO anon, authenticated;