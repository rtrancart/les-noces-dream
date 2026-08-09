ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consentement_marketing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consentement_marketing_le timestamptz,
  ADD COLUMN IF NOT EXISTS consentement_marketing_source text;

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
  _consent boolean;
BEGIN
  _consent := COALESCE((NEW.raw_user_meta_data->>'consentement_marketing')::boolean, false);

  INSERT INTO public.profiles (id, email, prenom, nom, consentement_marketing, consentement_marketing_le, consentement_marketing_source)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'prenom', NULL),
    COALESCE(NEW.raw_user_meta_data->>'nom', NULL),
    _consent,
    CASE WHEN _consent THEN now() ELSE NULL END,
    CASE WHEN _consent THEN 'inscription' ELSE NULL END
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

CREATE OR REPLACE FUNCTION public.definir_consentement_marketing(p_consent boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT lower(trim(email)) INTO v_email FROM public.profiles WHERE id = v_uid;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Profil introuvable';
  END IF;

  IF p_consent THEN
    IF EXISTS (SELECT 1 FROM public.oppositions_marketing WHERE email = v_email) THEN
      RAISE EXCEPTION 'Une opposition marketing définitive existe pour cette adresse';
    END IF;
    UPDATE public.profiles
      SET consentement_marketing = true,
          consentement_marketing_le = now(),
          consentement_marketing_source = 'espace_client'
    WHERE id = v_uid;
  ELSE
    UPDATE public.profiles
      SET consentement_marketing = false,
          consentement_marketing_le = now(),
          consentement_marketing_source = 'espace_client'
    WHERE id = v_uid;

    INSERT INTO public.oppositions_marketing (email, motif, source, metadata)
    VALUES (v_email, 'unsubscribe', 'compte_client', jsonb_build_object('profile_id', v_uid))
    ON CONFLICT (email) DO NOTHING;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://egbohbwiywgyyculswvf.supabase.co/functions/v1/brevo-consentement-marketing',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
        )
      ),
      body := jsonb_build_object('profile_id', v_uid)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'brevo-consentement-marketing wake failed: %', SQLERRM;
  END;

  RETURN p_consent;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.definir_consentement_marketing(boolean) TO authenticated;