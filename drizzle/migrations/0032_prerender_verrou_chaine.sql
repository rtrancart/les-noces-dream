CREATE TABLE public.prerender_chaine_verrou (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  chaine text NOT NULL,
  origine text NOT NULL,
  demarre_le timestamptz NOT NULL DEFAULT now(),
  dernier_saut timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.prerender_chaine_verrou TO service_role;
GRANT SELECT ON public.prerender_chaine_verrou TO authenticated;
ALTER TABLE public.prerender_chaine_verrou ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins lisent le verrou pre-rendu" ON public.prerender_chaine_verrou
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE OR REPLACE FUNCTION public.prerender_verrou_autorise()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(auth.role(),'') = 'service_role'
      OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin');
$$;

-- Prend le verrou si personne ne l'a, si c'est déjà le nôtre, ou si le dernier
-- saut date de 5 min ou plus (chaîne inactive ; expiré d'office après 10 min).
CREATE OR REPLACE FUNCTION public.prerender_verrou_prendre(p_chaine text, p_origine text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ok boolean;
BEGIN
  IF NOT public.prerender_verrou_autorise() THEN RAISE EXCEPTION 'Non autorisé'; END IF;
  DELETE FROM public.prerender_chaine_verrou WHERE dernier_saut < now() - interval '10 minutes';
  INSERT INTO public.prerender_chaine_verrou (id, chaine, origine)
  VALUES (true, p_chaine, p_origine)
  ON CONFLICT (id) DO UPDATE
    SET chaine = EXCLUDED.chaine, origine = EXCLUDED.origine,
        demarre_le = CASE WHEN prerender_chaine_verrou.chaine = EXCLUDED.chaine
                          THEN prerender_chaine_verrou.demarre_le ELSE now() END,
        dernier_saut = now()
    WHERE prerender_chaine_verrou.chaine = EXCLUDED.chaine
       OR prerender_chaine_verrou.dernier_saut < now() - interval '5 minutes'
  RETURNING true INTO v_ok;
  RETURN coalesce(v_ok, false);
END $$;

-- Signe de vie : vrai seulement si le verrou appartient toujours à cette chaîne.
CREATE OR REPLACE FUNCTION public.prerender_verrou_battre(p_chaine text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n int;
BEGIN
  IF NOT public.prerender_verrou_autorise() THEN RAISE EXCEPTION 'Non autorisé'; END IF;
  UPDATE public.prerender_chaine_verrou SET dernier_saut = now() WHERE chaine = p_chaine;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END $$;

CREATE OR REPLACE FUNCTION public.prerender_verrou_rendre(p_chaine text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.prerender_verrou_autorise() THEN RAISE EXCEPTION 'Non autorisé'; END IF;
  DELETE FROM public.prerender_chaine_verrou WHERE chaine = p_chaine;
END $$;

REVOKE ALL ON FUNCTION public.prerender_verrou_prendre(text,text), public.prerender_verrou_battre(text), public.prerender_verrou_rendre(text), public.prerender_verrou_autorise() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prerender_verrou_prendre(text,text), public.prerender_verrou_battre(text), public.prerender_verrou_rendre(text), public.prerender_verrou_autorise() TO authenticated, service_role;