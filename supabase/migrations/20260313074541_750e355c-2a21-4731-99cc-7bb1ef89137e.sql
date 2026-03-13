
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role app_role;
BEGIN
  -- Create profile with metadata from signup
  INSERT INTO public.profiles (id, email, prenom, nom)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'prenom', NULL),
    COALESCE(NEW.raw_user_meta_data->>'nom', NULL)
  );

  -- Determine role from signup metadata, default to client
  _role := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'role_souhaite', '')::app_role,
    'client'::app_role
  );

  -- Only allow client or prestataire from signup
  IF _role NOT IN ('client', 'prestataire') THEN
    _role := 'client';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);

  -- Merge contacts_anonymes if email exists
  UPDATE public.contacts_anonymes
  SET profile_id = NEW.id, merged_le = now()
  WHERE email = NEW.email AND profile_id IS NULL;

  RETURN NEW;
END;
$function$;
