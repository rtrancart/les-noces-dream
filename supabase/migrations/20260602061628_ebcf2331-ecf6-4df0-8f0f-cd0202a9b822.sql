
CREATE TABLE public.invitation_tokens (
  jti uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  prestataire_id uuid,
  action text NOT NULL DEFAULT 'accept_invitation',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  ip_consumed inet,
  user_agent_consumed text
);

CREATE INDEX idx_invitation_tokens_user_id ON public.invitation_tokens(user_id);
CREATE INDEX idx_invitation_tokens_expires_at ON public.invitation_tokens(expires_at);

GRANT SELECT, INSERT, UPDATE ON public.invitation_tokens TO authenticated;
GRANT ALL ON public.invitation_tokens TO service_role;

ALTER TABLE public.invitation_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view invitation tokens"
ON public.invitation_tokens FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Service role manages invitation tokens"
ON public.invitation_tokens FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
