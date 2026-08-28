CREATE OR REPLACE FUNCTION public.admin_stats_zones_categories()
RETURNS TABLE (
  scope text,
  zone_value text,
  zone_type text,
  label text,
  parent_region_zone_value text,
  dept_code text,
  categorie_mere_id uuid,
  categorie_nom text,
  statut statut_prestataire,
  nb bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT p.id, p.statut, p.categorie_mere_id, p.zones_intervention
    FROM public.prestataires p
    WHERE (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
      AND p.statut NOT IN ('archive', 'brouillon')
  ),
  deplie AS (
    SELECT b.id, b.statut, b.categorie_mere_id, z AS zv
    FROM base b, LATERAL unnest(b.zones_intervention) AS z
  )
  SELECT
    CASE WHEN zr.type IN ('region', 'departement') THEN 'carte' ELSE 'hors_carte' END AS scope,
    d.zv AS zone_value,
    COALESCE(zr.type, 'inconnu') AS zone_type,
    COALESCE(zr.label, d.zv) AS label,
    zr.parent_region_zone_value,
    zr.dept_code,
    d.categorie_mere_id,
    c.nom AS categorie_nom,
    d.statut,
    count(DISTINCT d.id) AS nb
  FROM deplie d
  LEFT JOIN public.zones_reference zr ON zr.zone_value = d.zv
  LEFT JOIN public.categories c ON c.id = d.categorie_mere_id
  GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9

  UNION ALL

  SELECT
    'non_localise' AS scope,
    NULL, NULL, 'Non localisées', NULL, NULL,
    b.categorie_mere_id,
    c.nom,
    b.statut,
    count(DISTINCT b.id)
  FROM base b
  LEFT JOIN public.categories c ON c.id = b.categorie_mere_id
  WHERE b.zones_intervention IS NULL OR cardinality(b.zones_intervention) = 0
  GROUP BY 1, 7, 8, 9;
$$;

REVOKE ALL ON FUNCTION public.admin_stats_zones_categories() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_stats_zones_categories() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_stats_zones_categories() TO service_role;