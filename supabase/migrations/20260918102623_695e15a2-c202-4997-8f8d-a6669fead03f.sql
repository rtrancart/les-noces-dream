CREATE TABLE public.monitoring_alertes (
  cle text PRIMARY KEY,
  dernier_envoi_le timestamptz,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.monitoring_alertes TO service_role;

ALTER TABLE public.monitoring_alertes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins peuvent lire les alertes techniques"
ON public.monitoring_alertes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

GRANT SELECT ON public.monitoring_alertes TO authenticated;

CREATE TRIGGER update_monitoring_alertes_updated_at
BEFORE UPDATE ON public.monitoring_alertes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Symptômes de panne silencieuse (lecture de schémas internes : SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.monitoring_symptomes()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
DECLARE
  v_401 integer := 0;
  v_401_premier timestamptz;
  v_bloques integer := 0;
  v_bloques_depuis timestamptz;
  v_dernier_rendu timestamptz;
BEGIN
  BEGIN
    SELECT count(*), min(created)
      INTO v_401, v_401_premier
      FROM net._http_response
     WHERE created > now() - interval '1 hour'
       AND status_code = 401;
  EXCEPTION WHEN others THEN
    v_401 := 0;
  END;

  SELECT count(*), min(updated_at)
    INTO v_bloques, v_bloques_depuis
    FROM public.brevo_sync_log
   WHERE statut = 'a_rejouer'
     AND updated_at < now() - interval '2 hours';

  SELECT max(rendu_le) INTO v_dernier_rendu FROM public.prerender_queue;

  RETURN jsonb_build_object(
    'http_401_nb', v_401,
    'http_401_premier', v_401_premier,
    'sync_bloques_nb', v_bloques,
    'sync_bloques_depuis', v_bloques_depuis,
    'prerender_dernier_rendu', v_dernier_rendu,
    'prerender_heures', CASE WHEN v_dernier_rendu IS NULL THEN NULL
      ELSE round(extract(epoch FROM now() - v_dernier_rendu) / 3600.0, 1) END,
    'calcule_le', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.monitoring_symptomes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.monitoring_symptomes() TO service_role;

-- Verrou anti-doublon : true si l'alerte peut être envoyée (aucun envoi < 24 h)
CREATE OR REPLACE FUNCTION public.monitoring_alerte_verrou(p_cle text, p_details jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ok boolean := false;
BEGIN
  INSERT INTO public.monitoring_alertes (cle, dernier_envoi_le, details)
  VALUES (p_cle, now(), p_details)
  ON CONFLICT (cle) DO UPDATE
    SET dernier_envoi_le = now(), details = p_details, updated_at = now()
    WHERE public.monitoring_alertes.dernier_envoi_le IS NULL
       OR public.monitoring_alertes.dernier_envoi_le < now() - interval '24 hours'
  RETURNING true INTO v_ok;
  RETURN coalesce(v_ok, false);
END;
$$;

REVOKE ALL ON FUNCTION public.monitoring_alerte_verrou(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.monitoring_alerte_verrou(text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.monitoring_alerte_liberer(p_cle text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.monitoring_alertes SET dernier_envoi_le = NULL, updated_at = now() WHERE cle = p_cle;
$$;

REVOKE ALL ON FUNCTION public.monitoring_alerte_liberer(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.monitoring_alerte_liberer(text) TO service_role;