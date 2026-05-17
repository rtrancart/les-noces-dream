CREATE OR REPLACE FUNCTION public.get_email_logs_for_recipient(
  p_recipient text,
  p_status text DEFAULT NULL,
  p_since timestamptz DEFAULT NULL,
  p_limit int DEFAULT 10,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  message_id text,
  template_name text,
  recipient_email text,
  status text,
  error_message text,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
       OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (COALESCE(l.message_id, l.id::text))
      l.id, l.message_id, l.template_name, l.recipient_email,
      l.status, l.error_message, l.created_at
    FROM public.email_send_log l
    WHERE l.recipient_email = lower(p_recipient)
      AND (p_since IS NULL OR l.created_at >= p_since)
    ORDER BY COALESCE(l.message_id, l.id::text), l.created_at DESC
  ),
  filtered AS (
    SELECT * FROM latest
    WHERE (p_status IS NULL OR status = p_status)
  ),
  counted AS (
    SELECT COUNT(*)::bigint AS c FROM filtered
  )
  SELECT f.id, f.message_id, f.template_name, f.recipient_email,
         f.status, f.error_message, f.created_at, counted.c
  FROM filtered f, counted
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_email_logs_for_recipient(text, text, timestamptz, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_email_logs_for_recipient(text, text, timestamptz, int, int) TO authenticated;