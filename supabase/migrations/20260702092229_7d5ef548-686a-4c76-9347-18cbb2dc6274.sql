ALTER TABLE public.prestataires
  ADD COLUMN IF NOT EXISTS raison_sociale text;

COMMENT ON COLUMN public.prestataires.raison_sociale IS
  'Nom légal de l''entreprise (facturation, comptabilité, Charte Qualité). Souvent identique au nom_commercial.';

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
  _nom_commercial text;
  _raison_sociale text;
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

  IF _role = 'prestataire' THEN
    SELECT id INTO _cat_id
    FROM public.categories
    WHERE parent_id IS NULL AND est_active = true
    ORDER BY ordre_affichage ASC
    LIMIT 1;

    IF _cat_id IS NOT NULL THEN
      _slug := 'prestataire-' || substr(NEW.id::text, 1, 8);

      _nom_commercial := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'nom_commercial'), ''),
        NULLIF(trim(concat_ws(' ',
          NEW.raw_user_meta_data->>'prenom',
          NEW.raw_user_meta_data->>'nom')), ''),
        'Prestataire à compléter'
      );

      _raison_sociale := NULLIF(trim(NEW.raw_user_meta_data->>'raison_sociale'), '');

      INSERT INTO public.prestataires (
        user_id, nom_commercial, raison_sociale, slug, categorie_mere_id,
        ville, region, email_contact, statut, premier_login_le
      )
      VALUES (
        NEW.id,
        _nom_commercial,
        _raison_sociale,
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