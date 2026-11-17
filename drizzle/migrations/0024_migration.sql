CREATE TABLE public.evenements_prestataire_backup_purge (
  id uuid PRIMARY KEY,
  prestataire_id uuid,
  type text,
  created_at timestamptz,
  motif text NOT NULL,
  archive_le timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.evenements_prestataire_backup_purge TO service_role;
GRANT SELECT ON public.evenements_prestataire_backup_purge TO authenticated;
ALTER TABLE public.evenements_prestataire_backup_purge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins lisent la sauvegarde" ON public.evenements_prestataire_backup_purge
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 1. Robots : nuit 03:00–04:59 UTC + 3 fenêtres de lots en journée
INSERT INTO public.evenements_prestataire_backup_purge (id, prestataire_id, type, created_at, motif)
SELECT id, prestataire_id, type, created_at,
  CASE WHEN extract(hour FROM created_at AT TIME ZONE 'UTC') IN (3,4) THEN 'cron_03h_04h' ELSE 'batch_test_day' END
FROM public.evenements_prestataire
WHERE type = 'vue_profil' AND (
  extract(hour FROM created_at AT TIME ZONE 'UTC') IN (3,4)
  OR ((created_at AT TIME ZONE 'UTC')::date = '2026-09-10' AND extract(hour FROM created_at AT TIME ZONE 'UTC') BETWEEN 14 AND 15)
  OR ((created_at AT TIME ZONE 'UTC')::date = '2026-10-01' AND extract(hour FROM created_at AT TIME ZONE 'UTC') BETWEEN 13 AND 16)
  OR ((created_at AT TIME ZONE 'UTC')::date = '2026-11-05' AND extract(hour FROM created_at AT TIME ZONE 'UTC') BETWEEN 14 AND 16)
);

-- 2. Doublons : 2e vue_profil < 1 s après la précédente sur la même fiche (hors robots)
INSERT INTO public.evenements_prestataire_backup_purge (id, prestataire_id, type, created_at, motif)
SELECT id, prestataire_id, type, created_at, 'doublon_double_fire'
FROM (
  SELECT e.*, lag(e.created_at) OVER (PARTITION BY e.prestataire_id ORDER BY e.created_at, e.id) AS prev
  FROM public.evenements_prestataire e
  WHERE e.type = 'vue_profil'
    AND NOT EXISTS (SELECT 1 FROM public.evenements_prestataire_backup_purge b WHERE b.id = e.id)
) s
WHERE prev IS NOT NULL AND created_at - prev < interval '1 second';

CREATE OR REPLACE FUNCTION public.admin_statistiques_activite_hebdo()
RETURNS TABLE(semaine_debut date, est_partielle boolean, visites bigint, demandes_devis bigint, telephones bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE lundi date := date_trunc('week', now() AT TIME ZONE 'Europe/Paris')::date;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH s AS (SELECT (lundi - (7*g))::date AS d FROM generate_series(0,7) g),
  ev AS (
    SELECT date_trunc('week', created_at AT TIME ZONE 'Europe/Paris')::date AS d, type
    FROM evenements_prestataire
    WHERE type IN ('vue_profil','affichage_telephone')
      AND (created_at AT TIME ZONE 'Europe/Paris') >= (lundi - 49)
  ),
  dv AS (
    SELECT date_trunc('week', created_at AT TIME ZONE 'Europe/Paris')::date AS d
    FROM demandes_devis
    WHERE moderation = 'valide' AND (created_at AT TIME ZONE 'Europe/Paris') >= (lundi - 49)
  )
  SELECT s.d, s.d = lundi,
    (SELECT count(*) FROM ev WHERE ev.d = s.d AND ev.type = 'vue_profil'),
    (SELECT count(*) FROM dv WHERE dv.d = s.d),
    (SELECT count(*) FROM ev WHERE ev.d = s.d AND ev.type = 'affichage_telephone')
  FROM s ORDER BY s.d;
END $$;
REVOKE ALL ON FUNCTION public.admin_statistiques_activite_hebdo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_statistiques_activite_hebdo() TO authenticated;