
CREATE OR REPLACE FUNCTION public.get_email_dashboard(
  p_since timestamptz DEFAULT now() - interval '7 days',
  p_until timestamptz DEFAULT now(),
  p_templates text[] DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  RETURN (
    WITH latest AS (
      SELECT DISTINCT ON (message_id) *
      FROM email_send_log
      WHERE message_id IS NOT NULL
      ORDER BY message_id, created_at DESC
    ),
    filtered AS (
      SELECT * FROM latest
      WHERE created_at >= p_since
        AND created_at <= p_until
        AND (p_templates IS NULL OR template_name = ANY (p_templates))
        AND (p_status IS NULL OR status = p_status)
    )
    SELECT jsonb_build_object(
      'stats', (
        SELECT jsonb_build_object(
          'total', count(*),
          'sent', count(*) FILTER (WHERE status = 'sent'),
          'failed', count(*) FILTER (WHERE status = 'dlq'),
          'bounced', count(*) FILTER (WHERE status = 'bounced'),
          'complained', count(*) FILTER (WHERE status = 'complained'),
          'suppressed', count(*) FILTER (WHERE status = 'suppressed'),
          'pending', count(*) FILTER (WHERE status = 'pending')
        )
        FROM filtered
      ),
      'total', (SELECT count(*) FROM filtered),
      'templates', (
        SELECT coalesce(jsonb_agg(t ORDER BY t), '[]'::jsonb)
        FROM (SELECT DISTINCT template_name AS t FROM email_send_log) s
      ),
      'rows', coalesce((
        SELECT jsonb_agg(row_to_json(f))
        FROM (
          SELECT message_id, template_name, recipient_email, status, error_message, created_at
          FROM filtered
          ORDER BY created_at DESC
          LIMIT p_limit OFFSET p_offset
        ) f
      ), '[]'::jsonb)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_email_dashboard(timestamptz, timestamptz, text[], text, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_email_dashboard(timestamptz, timestamptz, text[], text, integer, integer) TO authenticated;
