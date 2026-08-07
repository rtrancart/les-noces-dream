CREATE OR REPLACE FUNCTION public.brevo_compteurs_journal(
  p_ids uuid[],
  p_statut text,
  p_motif text DEFAULT NULL,
  p_status integer DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_statut NOT IN ('a_rejouer', 'reussi', 'abandonne') THEN
    RAISE EXCEPTION 'statut invalide';
  END IF;

  INSERT INTO public.brevo_sync_log (prestataire_id, kind, statut, tentatives, dernier_motif, dernier_status)
  SELECT id, 'compteurs_sync', p_statut, 1, p_motif, p_status
  FROM unnest(p_ids) AS id
  ON CONFLICT (prestataire_id, kind) WHERE prestataire_id IS NOT NULL
  DO UPDATE SET
    statut = EXCLUDED.statut,
    tentatives = CASE WHEN EXCLUDED.statut = 'reussi' THEN 0 ELSE public.brevo_sync_log.tentatives + 1 END,
    dernier_motif = EXCLUDED.dernier_motif,
    dernier_status = EXCLUDED.dernier_status,
    updated_at = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.brevo_compteurs_journal(uuid[], text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.brevo_compteurs_journal(uuid[], text, text, integer) TO service_role;