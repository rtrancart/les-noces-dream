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
  ),
  enrichi AS (
    SELECT d.*, zr.type AS ztype, zr.label AS zlabel,
           zr.parent_region_zone_value, zr.dept_code, c.nom AS categorie_nom
    FROM deplie d
    LEFT JOIN public.zones_reference zr ON zr.zone_value = d.zv
    LEFT JOIN public.categories c ON c.id = d.categorie_mere_id
  )
  -- Niveau département (et zones hors carte)
  SELECT
    CASE WHEN e.ztype IN ('region', 'departement') THEN 'carte' ELSE 'hors_carte' END,
    e.zv,
    COALESCE(e.ztype, 'inconnu'),
    COALESCE(e.zlabel, e.zv),
    e.parent_region_zone_value,
    e.dept_code,
    e.categorie_mere_id,
    e.categorie_nom,
    e.statut,
    count(DISTINCT e.id)
  FROM enrichi e
  GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9

  UNION ALL

  -- Niveau région : une fiche n'est comptée qu'une fois par région
  SELECT
    'carte_region',
    reg.zone_value,
    'region',
    reg.label,
    NULL,
    NULL,
    r.categorie_mere_id,
    r.categorie_nom,
    r.statut,
    count(DISTINCT r.id)
  FROM (
    SELECT e.id, e.statut, e.categorie_mere_id, e.categorie_nom,
           CASE WHEN e.ztype = 'region' THEN e.zv ELSE e.parent_region_zone_value END AS region_value
    FROM enrichi e
    WHERE e.ztype IN ('region', 'departement')
  ) r
  JOIN public.zones_reference reg
    ON reg.zone_value = r.region_value AND reg.type = 'region'
  GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9

  UNION ALL

  SELECT
    'non_localise', NULL, NULL, 'Non localisées', NULL, NULL,
    b.categorie_mere_id, c.nom, b.statut, count(DISTINCT b.id)
  FROM base b
  LEFT JOIN public.categories c ON c.id = b.categorie_mere_id
  WHERE b.zones_intervention IS NULL OR cardinality(b.zones_intervention) = 0
  GROUP BY 1, 7, 8, 9;
$$;