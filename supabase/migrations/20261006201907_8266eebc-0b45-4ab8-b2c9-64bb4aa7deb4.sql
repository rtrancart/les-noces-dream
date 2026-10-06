CREATE TABLE public.inscriptions_tentatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.inscriptions_tentatives TO service_role;
ALTER TABLE public.inscriptions_tentatives ENABLE ROW LEVEL SECURITY;
CREATE INDEX inscriptions_tentatives_ip_idx ON public.inscriptions_tentatives (ip_hash, created_at DESC);