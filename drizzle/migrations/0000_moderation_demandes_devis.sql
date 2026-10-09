ALTER TABLE public.demandes_devis
  ADD COLUMN moderation text NOT NULL DEFAULT 'valide',
  ADD COLUMN score_suspicion integer NOT NULL DEFAULT 0,
  ADD COLUMN raisons_suspicion text[] NOT NULL DEFAULT '{}',
  ADD COLUMN moderee_le timestamptz,
  ADD COLUMN moderee_par uuid,
  ADD COLUMN email_prestataire_envoye_le timestamptz,
  ADD COLUMN email_admin_envoye_le timestamptz;

ALTER TABLE public.demandes_devis
  ADD CONSTRAINT demandes_devis_moderation_check CHECK (moderation IN ('valide','a_verifier','rejete'));

CREATE OR REPLACE FUNCTION public.normaliser_telephone(p text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v text;
BEGIN
  v := regexp_replace(coalesce(p, ''), '[\s\.\-\(\)/]', '', 'g');
  IF v = '' THEN RETURN NULL; END IF;
  IF v LIKE '00%' THEN v := '+' || substr(v, 3); END IF;
  IF v ~ '^0[0-9]{9}$' THEN v := '+33' || substr(v, 2); END IF;
  IF v ~ '^\+330[0-9]{9}$' THEN v := '+33' || substr(v, 5); END IF;
  RETURN v;
END $$;

CREATE INDEX idx_demandes_email_created ON public.demandes_devis (lower(email_contact), created_at);
CREATE INDEX idx_demandes_tel_created ON public.demandes_devis (public.normaliser_telephone(telephone_contact), created_at);
CREATE INDEX idx_demandes_presta_email_created ON public.demandes_devis (prestataire_id, lower(email_contact), created_at);

CREATE TABLE public.domaines_email_jetables (
  domaine text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.domaines_email_jetables TO authenticated;
GRANT ALL ON public.domaines_email_jetables TO service_role;
ALTER TABLE public.domaines_email_jetables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gèrent les domaines jetables" ON public.domaines_email_jetables
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "Anyone can create demande for active prestataire" ON public.demandes_devis;

CREATE OR REPLACE FUNCTION public.demandes_devis_moderation_avant_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text := lower(trim(NEW.email_contact));
  v_tel text := public.normaliser_telephone(NEW.telephone_contact);
  v_score int := 0;
  v_raisons text[] := '{}';
  v_prefixes text[] := ARRAY['+33','+262','+590','+594','+596','+508','+681','+687','+689','+32','+41','+352','+377'];
  v_ok boolean;
  v_nb int;
  v_derniere timestamptz;
  v_invites numeric;
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

  IF btrim(coalesce(NEW.message, '')) !~ '\s' THEN
    v_score := v_score + 2;
    v_raisons := v_raisons || 'Message d''un seul mot'::text;
  END IF;

  NEW.score_suspicion := v_score;
  NEW.raisons_suspicion := v_raisons;
  NEW.moderation := CASE WHEN v_score >= 3 THEN 'a_verifier' ELSE 'valide' END;
  NEW.moderee_le := NULL;
  NEW.moderee_par := NULL;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_demandes_moderation_avant_insert
  BEFORE INSERT ON public.demandes_devis
  FOR EACH ROW EXECUTE FUNCTION public.demandes_devis_moderation_avant_insert();

CREATE OR REPLACE FUNCTION public.demandes_devis_proteger_moderation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon')
     AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
     AND (NEW.moderation IS DISTINCT FROM OLD.moderation
          OR NEW.score_suspicion IS DISTINCT FROM OLD.score_suspicion
          OR NEW.raisons_suspicion IS DISTINCT FROM OLD.raisons_suspicion
          OR NEW.moderee_le IS DISTINCT FROM OLD.moderee_le
          OR NEW.moderee_par IS DISTINCT FROM OLD.moderee_par
          OR NEW.email_prestataire_envoye_le IS DISTINCT FROM OLD.email_prestataire_envoye_le
          OR NEW.email_admin_envoye_le IS DISTINCT FROM OLD.email_admin_envoye_le) THEN
    RAISE EXCEPTION 'Champs de modération réservés à l''administration';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_demandes_proteger_moderation
  BEFORE UPDATE ON public.demandes_devis
  FOR EACH ROW EXECUTE FUNCTION public.demandes_devis_proteger_moderation();

-- Appel de la fonction d'envoi. La fonction est idempotente (réservation
-- atomique en base) : l'appel ne transporte aucun secret.
CREATE OR REPLACE FUNCTION public.appeler_notification_demandes(p_ids uuid[], p_kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := 'https://egbohbwiywgyyculswvf.supabase.co/functions/v1/notify-nouveau-contact-presta',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('demande_ids', to_jsonb(p_ids), 'kind', p_kind),
    timeout_milliseconds := 30000
  );
END $$;
REVOKE ALL ON FUNCTION public.appeler_notification_demandes(uuid[], text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.demandes_devis_notifier()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.moderation IS NOT DISTINCT FROM OLD.moderation THEN
    RETURN NULL;
  END IF;
  BEGIN
    IF NEW.moderation = 'valide' AND NEW.email_prestataire_envoye_le IS NULL THEN
      PERFORM public.appeler_notification_demandes(ARRAY[NEW.id], 'prestataire');
    ELSIF NEW.moderation = 'a_verifier' AND NEW.email_admin_envoye_le IS NULL THEN
      PERFORM public.appeler_notification_demandes(ARRAY[NEW.id], 'admin');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'demandes_devis_notifier failed (demande préservée, rattrapage nocturne): %', SQLERRM;
  END;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_demandes_notifier
  AFTER INSERT OR UPDATE OF moderation ON public.demandes_devis
  FOR EACH ROW EXECUTE FUNCTION public.demandes_devis_notifier();

CREATE OR REPLACE FUNCTION public.rattraper_emails_demandes()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_presta uuid[]; v_admin uuid[];
BEGIN
  SELECT array_agg(id) INTO v_presta FROM (
    SELECT id FROM public.demandes_devis
    WHERE moderation = 'valide' AND email_prestataire_envoye_le IS NULL
    ORDER BY created_at LIMIT 200) s;
  SELECT array_agg(id) INTO v_admin FROM (
    SELECT id FROM public.demandes_devis
    WHERE moderation = 'a_verifier' AND email_admin_envoye_le IS NULL
    ORDER BY created_at LIMIT 200) s;
  IF v_presta IS NOT NULL THEN PERFORM public.appeler_notification_demandes(v_presta, 'prestataire'); END IF;
  IF v_admin IS NOT NULL THEN PERFORM public.appeler_notification_demandes(v_admin, 'admin'); END IF;
  RETURN jsonb_build_object('prestataire', coalesce(array_length(v_presta,1),0), 'admin', coalesce(array_length(v_admin,1),0));
END $$;
REVOKE ALL ON FUNCTION public.rattraper_emails_demandes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_brevo_sync_contact ON public.demandes_devis;
CREATE TRIGGER trg_brevo_sync_contact
  AFTER INSERT ON public.demandes_devis
  FOR EACH ROW WHEN (NEW.moderation = 'valide')
  EXECUTE FUNCTION public.brevo_sync_contact_wake();
CREATE TRIGGER trg_brevo_sync_contact_moderation
  AFTER UPDATE OF moderation ON public.demandes_devis
  FOR EACH ROW WHEN (OLD.moderation IS DISTINCT FROM NEW.moderation AND NEW.moderation = 'valide')
  EXECUTE FUNCTION public.brevo_sync_contact_wake();

DROP TRIGGER IF EXISTS trg_score_demandes ON public.demandes_devis;
CREATE TRIGGER trg_score_demandes
  AFTER INSERT ON public.demandes_devis
  FOR EACH ROW WHEN (NEW.moderation = 'valide')
  EXECUTE FUNCTION public.trg_score_demandes();

CREATE OR REPLACE FUNCTION public.trg_demande_moderation_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_taux numeric; v_nb int; v_new numeric;
BEGIN
  SELECT taux, nb_demandes INTO v_taux, v_nb FROM public.calculer_taux_reponse(NEW.prestataire_id);
  UPDATE public.prestataires
     SET taux_reponse = v_taux, taux_reponse_nb_demandes_90j = v_nb, taux_reponse_calcule_le = now()
   WHERE id = NEW.prestataire_id
     AND (taux_reponse IS DISTINCT FROM v_taux OR taux_reponse_nb_demandes_90j IS DISTINCT FROM v_nb);
  v_new := public.calculer_score_classement(NEW.prestataire_id);
  UPDATE public.prestataires SET score_classement = v_new
   WHERE id = NEW.prestataire_id AND score_classement IS DISTINCT FROM v_new;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_score_demandes_moderation
  AFTER UPDATE OF moderation ON public.demandes_devis
  FOR EACH ROW WHEN (OLD.moderation IS DISTINCT FROM NEW.moderation)
  EXECUTE FUNCTION public.trg_demande_moderation_score();

CREATE OR REPLACE FUNCTION public.calculer_taux_reponse(p_prestataire_id uuid)
 RETURNS TABLE(taux numeric, nb_demandes integer)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_total integer := 0;
  v_dans_delai integer := 0;
BEGIN
  WITH base AS (
    SELECT dd.id AS demande_id,
           dd.created_at,
           (SELECT MIN(m.created_at)
              FROM public.messages m
             WHERE m.demande_id = dd.id
               AND m.expediteur_type = 'prestataire') AS premiere_reponse
      FROM public.demandes_devis dd
     WHERE dd.prestataire_id = p_prestataire_id
       AND dd.moderation = 'valide'
       AND dd.created_at >= now() - interval '90 days'
  )
  SELECT COUNT(*)::int,
         COUNT(*) FILTER (
           WHERE premiere_reponse IS NOT NULL
             AND public.heures_ouvrees_entre(created_at, premiere_reponse) <= 72
         )::int
    INTO v_total, v_dans_delai
    FROM base;

  IF v_total = 0 THEN
    RETURN QUERY SELECT NULL::numeric, 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT ROUND((v_dans_delai::numeric / v_total) * 100, 2), v_total;
END;
$function$;

CREATE OR REPLACE FUNCTION public.brevo_compteurs_prestataires(p_limit integer DEFAULT 500, p_offset integer DEFAULT 0)
 RETURNS TABLE(prestataire_id uuid, email text, nb_vues integer, nb_demandes integer, nb_favoris integer, taux_reponse numeric, note_moyenne real, oppose boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH page AS (
    SELECT p.id, lower(trim(p.email_contact)) AS email, p.taux_reponse, p.note_moyenne
    FROM public.prestataires p
    WHERE p.email_contact IS NOT NULL AND trim(p.email_contact) <> ''
    ORDER BY p.id
    LIMIT p_limit OFFSET p_offset
  )
  SELECT
    page.id,
    page.email,
    COALESCE((SELECT count(*) FROM public.evenements_prestataire e
               WHERE e.prestataire_id = page.id AND e.type = 'vue_profil'), 0)::int,
    COALESCE((SELECT count(*) FROM public.demandes_devis d
               WHERE d.prestataire_id = page.id AND d.moderation = 'valide'), 0)::int,
    COALESCE((SELECT count(*) FROM public.favoris f
               WHERE f.prestataire_id = page.id), 0)::int,
    page.taux_reponse,
    round(page.note_moyenne::numeric, 1)::real,
    EXISTS (SELECT 1 FROM public.oppositions_marketing o WHERE o.email = page.email)
  FROM page
  ORDER BY page.id;
$function$;

CREATE OR REPLACE FUNCTION public.can_review_prestataire(p_prestataire_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.demandes_devis dd
    JOIN public.profiles p ON p.email = dd.email_contact
    WHERE dd.prestataire_id = p_prestataire_id
      AND dd.moderation = 'valide'
      AND p.id = auth.uid()
  )
$function$;

DROP POLICY IF EXISTS "Participants can view demandes" ON public.demandes_devis;
CREATE POLICY "Participants can view demandes" ON public.demandes_devis FOR SELECT
USING (
  profile_id = auth.uid()
  OR (moderation = 'valide' AND EXISTS (SELECT 1 FROM public.prestataires p WHERE p.id = demandes_devis.prestataire_id AND p.user_id = auth.uid()))
  OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')
);

DROP POLICY IF EXISTS "Owner prestataire can update demande" ON public.demandes_devis;
CREATE POLICY "Owner prestataire can update demande" ON public.demandes_devis FOR UPDATE TO authenticated
USING (moderation = 'valide' AND EXISTS (SELECT 1 FROM public.prestataires p WHERE p.id = demandes_devis.prestataire_id AND p.user_id = auth.uid()))
WITH CHECK (moderation = 'valide' AND EXISTS (SELECT 1 FROM public.prestataires p WHERE p.id = demandes_devis.prestataire_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages" ON public.messages FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.demandes_devis dd WHERE dd.id = messages.demande_id
          AND (dd.profile_id = auth.uid()
               OR (dd.moderation = 'valide' AND EXISTS (SELECT 1 FROM public.prestataires p WHERE p.id = dd.prestataire_id AND p.user_id = auth.uid()))))
  OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')
);

DROP POLICY IF EXISTS "Participants can insert messages" ON public.messages;
CREATE POLICY "Participants can insert messages" ON public.messages FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.demandes_devis dd WHERE dd.id = messages.demande_id
          AND (dd.profile_id = auth.uid()
               OR (dd.moderation = 'valide' AND EXISTS (SELECT 1 FROM public.prestataires p WHERE p.id = dd.prestataire_id AND p.user_id = auth.uid()))))
);

DROP POLICY IF EXISTS "Participants can update messages" ON public.messages;
CREATE POLICY "Participants can update messages" ON public.messages FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.demandes_devis dd WHERE dd.id = messages.demande_id
          AND (dd.profile_id = auth.uid()
               OR (dd.moderation = 'valide' AND EXISTS (SELECT 1 FROM public.prestataires p WHERE p.id = dd.prestataire_id AND p.user_id = auth.uid()))))
);

DROP POLICY IF EXISTS "Participants can subscribe to conversation channel" ON realtime.messages;
CREATE POLICY "Participants can subscribe to conversation channel" ON realtime.messages FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')
  OR ((realtime.topic() LIKE 'messages-%') AND EXISTS (
    SELECT 1 FROM public.demandes_devis dd
    WHERE dd.id::text = substring(realtime.topic(), 'messages-(.*)')
      AND (dd.profile_id = auth.uid()
           OR (dd.moderation = 'valide' AND EXISTS (SELECT 1 FROM public.prestataires p WHERE p.id = dd.prestataire_id AND p.user_id = auth.uid())))))
);
