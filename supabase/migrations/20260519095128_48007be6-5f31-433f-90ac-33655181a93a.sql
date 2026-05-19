
-- handle_new_user : crée également la fiche prestataire pour les auto-inscriptions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role public.app_role;
  _cat_id uuid;
  _slug text;
BEGIN
  INSERT INTO public.profiles (id, email, prenom, nom)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'prenom', NULL),
    COALESCE(NEW.raw_user_meta_data->>'nom', NULL)
  );

  _role := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'role_souhaite', '')::public.app_role,
    'client'::public.app_role
  );
  IF _role NOT IN ('client', 'prestataire') THEN
    _role := 'client';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);

  UPDATE public.contacts_anonymes
  SET profile_id = NEW.id, merged_le = now()
  WHERE email = NEW.email AND profile_id IS NULL;

  -- Auto-inscription prestataire : créer la fiche minimale en statut a_completer
  IF _role = 'prestataire' THEN
    SELECT id INTO _cat_id
    FROM public.categories
    WHERE parent_id IS NULL AND est_active = true
    ORDER BY ordre_affichage ASC
    LIMIT 1;

    IF _cat_id IS NOT NULL THEN
      _slug := 'prestataire-' || substr(NEW.id::text, 1, 8);
      INSERT INTO public.prestataires (
        user_id, nom_commercial, slug, categorie_mere_id,
        ville, region, email_contact, statut, premier_login_le
      )
      VALUES (
        NEW.id,
        COALESCE(NULLIF(trim(concat_ws(' ',
          NEW.raw_user_meta_data->>'prenom',
          NEW.raw_user_meta_data->>'nom')), ''), 'Prestataire à compléter'),
        _slug,
        _cat_id,
        'À compléter',
        'À compléter',
        NEW.email,
        'a_completer'::public.statut_prestataire,
        now()
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- RPC : appelée par le front à la première connexion d'un prestataire invité
CREATE OR REPLACE FUNCTION public.mark_prestataire_first_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  UPDATE public.prestataires
  SET
    premier_login_le = COALESCE(premier_login_le, now()),
    statut = CASE
      WHEN statut = 'pre_inscrit'::public.statut_prestataire
        THEN 'a_completer'::public.statut_prestataire
      ELSE statut
    END
  WHERE user_id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_prestataire_first_login() TO authenticated;
