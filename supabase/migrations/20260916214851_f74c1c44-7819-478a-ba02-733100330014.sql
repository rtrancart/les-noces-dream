CREATE OR REPLACE FUNCTION public.appliquer_verification_emails(p_data jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  WITH v AS (
    SELECT lower(trim(x->>'e')) AS e, (x->>'s')::public.verification_email AS s
    FROM jsonb_array_elements(p_data) AS x
  )
  UPDATE public.prestataires p
  SET email_verifie = v.s
  FROM v
  WHERE lower(trim(p.email_contact)) = v.e;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.appliquer_verification_emails(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.appliquer_verification_emails(jsonb) TO service_role;