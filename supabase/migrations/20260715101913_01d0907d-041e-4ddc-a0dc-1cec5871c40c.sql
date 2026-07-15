
-- 1. Drop old policy (connected users only)
DROP POLICY IF EXISTS "Clients can submit reviews (pending moderation)" ON public.avis;

-- 2. New INSERT policy for authenticated users (kept as fallback; RPC still preferred)
CREATE POLICY "Authenticated clients can submit reviews"
ON public.avis
FOR INSERT
TO authenticated
WITH CHECK (
  client_id = auth.uid()
  AND contact_id IS NULL
  AND statut = 'en_attente'
  AND NOT EXISTS (
    SELECT 1 FROM public.prestataires p
    WHERE p.id = avis.prestataire_id AND p.user_id = auth.uid()
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.avis a
    WHERE a.client_id = auth.uid() AND a.prestataire_id = avis.prestataire_id
  )
);

-- 3. Submission function (works for anon and authenticated)
CREATE OR REPLACE FUNCTION public.soumettre_avis(
  p_prestataire_id uuid,
  p_note_qualite_presta smallint,
  p_note_professionnalisme smallint,
  p_note_rapport_qualite_prix smallint,
  p_note_flexibilite smallint,
  p_commentaire text,
  p_nom text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_contact_id uuid;
  v_client_id uuid;
  v_avis_id uuid;
  v_note_globale real;
  v_comment text := trim(coalesce(p_commentaire, ''));
BEGIN
  -- Validate notes
  IF p_note_qualite_presta NOT BETWEEN 1 AND 5
     OR p_note_professionnalisme NOT BETWEEN 1 AND 5
     OR p_note_rapport_qualite_prix NOT BETWEEN 1 AND 5
     OR p_note_flexibilite NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Notes invalides (1 à 5)';
  END IF;

  IF length(v_comment) = 0 OR length(v_comment) > 2000 THEN
    RAISE EXCEPTION 'Commentaire requis (max 2000 caractères)';
  END IF;

  -- Prestataire must exist and be active
  IF NOT EXISTS (SELECT 1 FROM public.prestataires WHERE id = p_prestataire_id AND statut = 'actif') THEN
    RAISE EXCEPTION 'Prestataire introuvable ou inactif';
  END IF;

  IF v_user_id IS NOT NULL THEN
    -- Authenticated flow
    v_client_id := v_user_id;

    -- No self-review
    IF EXISTS (SELECT 1 FROM public.prestataires WHERE id = p_prestataire_id AND user_id = v_user_id) THEN
      RAISE EXCEPTION 'Vous ne pouvez pas laisser d''avis sur votre propre fiche';
    END IF;

    -- Anti-doublon
    IF EXISTS (SELECT 1 FROM public.avis WHERE client_id = v_user_id AND prestataire_id = p_prestataire_id) THEN
      RAISE EXCEPTION 'Vous avez déjà déposé un avis pour ce prestataire';
    END IF;

    -- Optionally link email profile if we have one
  ELSE
    -- Anonymous flow: nom + email required
    IF length(coalesce(trim(p_nom), '')) < 2 THEN
      RAISE EXCEPTION 'Nom requis';
    END IF;
    IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
      RAISE EXCEPTION 'Email invalide';
    END IF;

    -- Get or create contact
    SELECT id INTO v_contact_id FROM public.contacts_anonymes WHERE email = v_email LIMIT 1;
    IF v_contact_id IS NULL THEN
      INSERT INTO public.contacts_anonymes (email, prenom, origine_premiere)
      VALUES (v_email, split_part(trim(p_nom), ' ', 1), 'avis_fiche')
      RETURNING id INTO v_contact_id;
    END IF;

    -- Anti-doublon par contact
    IF EXISTS (SELECT 1 FROM public.avis WHERE contact_id = v_contact_id AND prestataire_id = p_prestataire_id) THEN
      RAISE EXCEPTION 'Un avis a déjà été déposé avec cet email pour ce prestataire';
    END IF;
  END IF;

  v_note_globale := (p_note_qualite_presta * 2 + p_note_professionnalisme + p_note_rapport_qualite_prix + p_note_flexibilite)::real / 5.0;

  INSERT INTO public.avis (
    prestataire_id, client_id, contact_id,
    note_qualite_presta, note_professionnalisme, note_rapport_qualite_prix, note_flexibilite,
    note_globale, commentaire, statut
  ) VALUES (
    p_prestataire_id, v_client_id, v_contact_id,
    p_note_qualite_presta, p_note_professionnalisme, p_note_rapport_qualite_prix, p_note_flexibilite,
    v_note_globale, v_comment, 'en_attente'
  )
  RETURNING id INTO v_avis_id;

  RETURN v_avis_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soumettre_avis(uuid, smallint, smallint, smallint, smallint, text, text, text) TO anon, authenticated;
