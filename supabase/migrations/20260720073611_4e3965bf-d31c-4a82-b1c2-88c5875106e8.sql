ALTER TABLE public.prestataires
ADD COLUMN IF NOT EXISTS dernier_contact_tunnel_a_envoye_le timestamptz;

COMMENT ON COLUMN public.prestataires.dernier_contact_tunnel_a_envoye_le IS
'Horodatage du dernier contact J+14 Tunnel A (verrou idempotent cron-dernier-contact-tunnel-a).';