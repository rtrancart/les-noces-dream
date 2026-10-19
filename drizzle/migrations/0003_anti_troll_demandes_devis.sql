ALTER TABLE public.demandes_devis ADD COLUMN IF NOT EXISTS ip_client text, ADD COLUMN IF NOT EXISTS ip_pays text;

CREATE OR REPLACE FUNCTION public.demandes_devis_moderation_avant_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text := lower(trim(NEW.email_contact));
  v_tel text := public.normaliser_telephone(NEW.telephone_contact);
  v_score int := 0;
  v_raisons text[] := '{}';
  v_prefixes text[] := ARRAY['+33','+262','+590','+594','+596','+508','+681','+687','+689','+32','+41','+352','+377'];
  v_pays_ok text[] := ARRAY['FR','BE','CH','LU','MC','RE','GP','GF','MQ','PM','WF','NC','PF','YT','BL','MF','DE','ES','IT','GB','NL','PT','IE','AT','CA','US','AD'];
  v_ok boolean;
  v_nb int;
  v_derniere timestamptz;
  v_invites numeric;
  v_headers json;
  v_msg text := btrim(coalesce(NEW.message, ''));
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.demandes_devis d
    WHERE d.prestataire_id = NEW.prestataire_id
      AND d.created_at > now() - interval '24 hours'
      AND (lower(d.email_contact) = v_email
           OR (v_tel IS NOT NULL AND public.normaliser_telephone(d.telephone_contact) = v_tel))
  ) THEN
    RAISE EXCEPTION 'DEMANDE_DOUBLON' USING ERRCODE = 'LN409',
      HINT = 'Vous avez déjà contacté ce prestataire, il reviendra vers vous rapidement.';
  END IF;

  BEGIN
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN OTHERS THEN v_headers := NULL;
  END;
  IF v_headers IS NOT NULL THEN
    NEW.ip_client := coalesce(v_headers->>'cf-connecting-ip', split_part(v_headers->>'x-forwarded-for', ',', 1), v_headers->>'x-real-ip');
    NEW.ip_pays := upper(nullif(v_headers->>'cf-ipcountry', ''));
  END IF;
  IF NEW.ip_pays IS NOT NULL AND NEW.ip_pays <> 'XX' AND NOT (NEW.ip_pays = ANY(v_pays_ok)) THEN
    v_score := v_score + 3;
    v_raisons := v_raisons || ('Connexion depuis un pays inhabituel : ' || NEW.ip_pays);
  END IF;

  IF v_tel IS NOT NULL AND v_tel LIKE '+%' THEN
    SELECT bool_or(v_tel LIKE p || '%') INTO v_ok FROM unnest(v_prefixes) p;
    IF NOT coalesce(v_ok, false) THEN
      v_score := v_score + 3;
      v_raisons := v_raisons || ('Indicatif hors zone : ' || substring(v_tel from '^\+[0-9]{1,3}'));
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.domaines_email_jetables j WHERE j.domaine = split_part(v_email, '@', 2)) THEN
    v_score := v_score + 3;
    v_raisons := v_raisons || ('Adresse email jetable : ' || split_part(v_email, '@', 2));
  END IF;

  SELECT count(*), max(created_at) INTO v_nb, v_derniere
  FROM public.demandes_devis d
  WHERE lower(d.email_contact) = v_email AND d.created_at > now() - interval '24 hours';
  IF v_nb >= 40 THEN
    v_score := v_score + 2;
    v_raisons := v_raisons || ('Plus de 40 demandes en 24 h avec cet email (' || (v_nb + 1) || ')');
  END IF;
  IF v_derniere IS NOT NULL AND now() - v_derniere < interval '15 seconds' THEN
    v_score := v_score + 2;
    v_raisons := v_raisons || 'Moins de 15 secondes depuis la précédente demande de cet email'::text;
  END IF;

  SELECT max(m[1]::numeric) INTO v_invites
  FROM regexp_matches(coalesce(NEW.nombre_invites_rang, ''), '([0-9]+)', 'g') m;
  IF v_invites > 500 THEN
    v_score := v_score + 1;
    v_raisons := v_raisons || ('Nombre d''invités élevé : ' || NEW.nombre_invites_rang);
  END IF;

  IF v_msg !~ '\s' THEN
    v_score := v_score + 3;
    v_raisons := v_raisons || 'Message d''un seul mot'::text;
  ELSIF char_length(v_msg) < 15 THEN
    v_score := v_score + 3;
    v_raisons := v_raisons || 'Message trop court'::text;
  END IF;

  IF v_msg ~* '([a-z])\1{3,}' THEN
    v_score := v_score + 3;
    v_raisons := v_raisons || 'Lettres répétées anormalement (charabia)'::text;
  END IF;

  NEW.score_suspicion := v_score;
  NEW.raisons_suspicion := v_raisons;
  NEW.moderation := CASE WHEN v_score >= 3 THEN 'a_verifier' ELSE 'valide' END;
  NEW.moderee_le := NULL;
  NEW.moderee_par := NULL;
  RETURN NEW;
END $$;