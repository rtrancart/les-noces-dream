CREATE OR REPLACE FUNCTION public.admin_stats_zones_categories_json()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  FROM public.admin_stats_zones_categories() t;
$$;

REVOKE ALL ON FUNCTION public.admin_stats_zones_categories_json() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_stats_zones_categories_json() TO authenticated, service_role;