ALTER TABLE public.demandes_devis ADD COLUMN date_precision text;

UPDATE public.demandes_devis SET date_precision = 'jour' WHERE date_evenement IS NOT NULL;

ALTER TABLE public.demandes_devis
  ADD CONSTRAINT check_demandes_date_precision
  CHECK (date_precision IS NULL OR date_precision IN ('jour', 'mois'));

ALTER TABLE public.demandes_devis
  ADD CONSTRAINT check_demandes_date_coherence
  CHECK ((date_evenement IS NULL AND date_precision IS NULL) OR (date_evenement IS NOT NULL AND date_precision IS NOT NULL));

DROP FUNCTION IF EXISTS public.soumettre_demande_devis(uuid, text, text, text, objet_demande, text, date, text, text, integer);

CREATE FUNCTION public.soumettre_demande_devis(p_prestataire_id uuid, p_nom text, p_email text, p_telephone text, p_objet objet_demande, p_message text, p_date_evenement date DEFAULT NULL::date, p_lieu_evenement text DEFAULT NULL::text, p_nombre_invites_rang text DEFAULT NULL::text, p_budget_indicatif integer DEFAULT NULL::integer, p_date_precision text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := lower(trim(p_email));
  v_contact_id uuid;
  v_demande_id uuid;
  v_moderation text;
  v_user_id uuid := auth.uid();
  v_precision text;
  v_aujourdhui_paris date;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.prestataires
    WHERE id = p_prestataire_id AND statut = 'actif'
  ) THEN
    RAISE EXCEPTION 'Prestataire introuvable ou inactif';
  END IF;

  IF p_date_evenement IS NOT NULL THEN
    v_precision := COALESCE(p_date_precision, 'jour');
    IF v_precision NOT IN ('jour', 'mois') THEN
      RAISE EXCEPTION 'Précision de date invalide: % (attendu: jour ou mois)', v_precision;
    END IF;

    v_aujourdhui_paris := (timezone('Europe/Paris', now()))::date;

    IF v_precision = 'jour' AND p_date_evenement < v_aujourdhui_paris THEN
      RAISE EXCEPTION 'La date de l''événement ne peut pas être antérieure à aujourd''hui';
    ELSIF v_precision = 'mois' AND date_trunc('month', p_date_evenement)::date < date_trunc('month', v_aujourdhui_paris)::date THEN
      RAISE EXCEPTION 'Le mois de l''événement ne peut pas être antérieur au mois en cours';
    END IF;
  ELSE
    v_precision := NULL;
  END IF;

  SELECT id INTO v_contact_id FROM public.contacts_anonymes WHERE email = v_email LIMIT 1;

  IF v_contact_id IS NULL THEN
    INSERT INTO public.contacts_anonymes (email, prenom, telephone, origine_premiere, profile_id)
    VALUES (v_email, split_part(p_nom, ' ', 1), p_telephone, 'fiche_prestataire', v_user_id)
    RETURNING id INTO v_contact_id;
  ELSE
    UPDATE public.contacts_anonymes
    SET telephone = COALESCE(p_telephone, telephone),
        profile_id = COALESCE(profile_id, v_user_id),
        updated_at = now()
    WHERE id = v_contact_id;
  END IF;

  INSERT INTO public.demandes_devis (
    prestataire_id, contact_id, profile_id,
    nom_contact, email_contact, telephone_contact,
    objet, date_evenement, date_precision, lieu_evenement, nombre_invites_rang, message, budget_indicatif
  ) VALUES (
    p_prestataire_id, v_contact_id, v_user_id,
    p_nom, v_email, p_telephone,
    p_objet, p_date_evenement, v_precision, p_lieu_evenement, p_nombre_invites_rang, p_message, p_budget_indicatif
  )
  RETURNING id, moderation INTO v_demande_id, v_moderation;

  RETURN jsonb_build_object('demande_id', v_demande_id, 'moderation', v_moderation);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.soumettre_demande_devis(uuid, text, text, text, objet_demande, text, date, text, text, integer, text) TO anon, authenticated;