CREATE OR REPLACE FUNCTION public.prevent_invitation_token_proof_modification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Ne verrouille que les lignes déjà consommées.
  IF OLD.consumed_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.consumed_at IS DISTINCT FROM OLD.consumed_at
     OR NEW.ip_consumed IS DISTINCT FROM OLD.ip_consumed
     OR NEW.user_agent_consumed IS DISTINCT FROM OLD.user_agent_consumed THEN
    RAISE EXCEPTION 'Les colonnes probatoires d''un token d''invitation déjà consommé (consumed_at, ip_consumed, user_agent_consumed) sont immuables et ne peuvent être modifiées (convention de preuve, art. 11 Charte).';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_invitation_token_proof_modification ON public.invitation_tokens;
CREATE TRIGGER trg_prevent_invitation_token_proof_modification
BEFORE UPDATE ON public.invitation_tokens
FOR EACH ROW
EXECUTE FUNCTION public.prevent_invitation_token_proof_modification();