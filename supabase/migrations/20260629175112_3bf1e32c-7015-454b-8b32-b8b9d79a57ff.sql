
-- 1. Colonnes pour le taux de réponse
ALTER TABLE public.prestataires
  ADD COLUMN IF NOT EXISTS taux_reponse numeric(5,2) DEFAULT 100,
  ADD COLUMN IF NOT EXISTS taux_reponse_calcule_le timestamptz,
  ADD COLUMN IF NOT EXISTS taux_reponse_nb_demandes_90j integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taux_reponse_alerte_envoyee_le timestamptz;

-- 2. Fonction heures ouvrées entre deux timestamps (Mon-Fri 9h-18h, TZ Europe/Paris)
CREATE OR REPLACE FUNCTION public.heures_ouvrees_entre(ts_debut timestamptz, ts_fin timestamptz)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  d_local timestamp;
  f_local timestamp;
  cur date;
  jour_debut timestamp;
  jour_fin timestamp;
  inter_debut timestamp;
  inter_fin timestamp;
  total numeric := 0;
BEGIN
  IF ts_debut IS NULL OR ts_fin IS NULL OR ts_fin <= ts_debut THEN
    RETURN 0;
  END IF;

  d_local := (ts_debut AT TIME ZONE 'Europe/Paris');
  f_local := (ts_fin AT TIME ZONE 'Europe/Paris');
  cur := d_local::date;

  WHILE cur <= f_local::date LOOP
    -- 1=lundi … 7=dimanche
    IF EXTRACT(ISODOW FROM cur) < 6 THEN
      jour_debut := cur + time '09:00';
      jour_fin   := cur + time '18:00';
      inter_debut := GREATEST(jour_debut, d_local);
      inter_fin   := LEAST(jour_fin, f_local);
      IF inter_fin > inter_debut THEN
        total := total + EXTRACT(EPOCH FROM (inter_fin - inter_debut)) / 3600.0;
      END IF;
    END IF;
    cur := cur + 1;
  END LOOP;

  RETURN total;
END;
$$;

-- 3. Calcul du taux de réponse sur 90 jours glissants
CREATE OR REPLACE FUNCTION public.calculer_taux_reponse(p_prestataire_id uuid)
RETURNS TABLE(taux numeric, nb_demandes integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.heures_ouvrees_entre(timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculer_taux_reponse(uuid) TO authenticated, service_role;
