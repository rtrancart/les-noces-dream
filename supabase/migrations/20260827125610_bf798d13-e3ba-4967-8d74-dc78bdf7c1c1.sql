-- 1. Table de sauvegarde
CREATE TABLE public.zones_intervention_backup (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prestataire_id uuid NOT NULL REFERENCES public.prestataires(id) ON DELETE CASCADE,
  zones_avant text[],
  zones_apres text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.zones_intervention_backup TO authenticated;
GRANT ALL ON public.zones_intervention_backup TO service_role;

ALTER TABLE public.zones_intervention_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins peuvent consulter les sauvegardes de zones"
ON public.zones_intervention_backup FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 2. Clé de normalisation partagée
CREATE OR REPLACE FUNCTION public.cle_zone_normalisee(p_valeur text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(lower(public.immutable_unaccent(coalesce(p_valeur, ''))), '[^a-z0-9]+', '', 'g')
$$;

-- 3. Résolution d'une valeur vers la zone_value canonique (NULL si inconnue)
CREATE OR REPLACE FUNCTION public.resoudre_zone_intervention(p_valeur text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_cle text;
  v_res text;
BEGIN
  IF p_valeur IS NULL OR btrim(p_valeur) = '' THEN
    RETURN NULL;
  END IF;

  v_cle := public.cle_zone_normalisee(p_valeur);

  IF v_cle = 'franceentiere' THEN
    RETURN 'france_entiere';
  END IF;

  SELECT r.zone_value INTO v_res
  FROM public.zones_reference r
  WHERE public.cle_zone_normalisee(r.zone_value) = v_cle
     OR public.cle_zone_normalisee(r.slug) = v_cle
     OR public.cle_zone_normalisee(r.label) = v_cle
  ORDER BY (public.cle_zone_normalisee(r.zone_value) = v_cle) DESC
  LIMIT 1;

  RETURN v_res;
END;
$$;

-- 4. Trigger tolérant de normalisation
CREATE OR REPLACE FUNCTION public.normaliser_zones_intervention()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_in text;
  v_out text;
  v_res text[] := ARRAY[]::text[];
  v_inconnues text[] := ARRAY[]::text[];
BEGIN
  IF NEW.zones_intervention IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.zones_intervention IS NOT DISTINCT FROM NEW.zones_intervention THEN
    RETURN NEW;
  END IF;

  FOREACH v_in IN ARRAY NEW.zones_intervention LOOP
    v_out := public.resoudre_zone_intervention(v_in);
    IF v_out IS NULL THEN
      IF NOT (v_in = ANY(v_inconnues)) THEN
        v_inconnues := v_inconnues || v_in;
      END IF;
    ELSIF NOT (v_out = ANY(v_res)) THEN
      v_res := v_res || v_out;
    END IF;
  END LOOP;

  NEW.zones_intervention := v_res;

  IF array_length(v_inconnues, 1) > 0 THEN
    RAISE WARNING 'zones_intervention inconnues ignorées pour % : %', NEW.id, v_inconnues;
    BEGIN
      INSERT INTO public.logs_admin (admin_id, action, entite, entite_id, details)
      VALUES (
        coalesce(auth.uid(), NEW.user_id),
        'zone_intervention_inconnue',
        'prestataires',
        NEW.id,
        jsonb_build_object('valeurs_ignorees', to_jsonb(v_inconnues))
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- ne jamais faire échouer l'écriture de la fiche
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normaliser_zones_intervention ON public.prestataires;
CREATE TRIGGER trg_normaliser_zones_intervention
BEFORE INSERT OR UPDATE OF zones_intervention ON public.prestataires
FOR EACH ROW EXECUTE FUNCTION public.normaliser_zones_intervention();