ALTER TABLE public.prestataires
  ADD COLUMN IF NOT EXISTS siret text,
  ADD COLUMN IF NOT EXISTS tva_intracom text;

CREATE TABLE IF NOT EXISTS public.factures_pennylane (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestataire_id uuid NOT NULL REFERENCES public.prestataires(id) ON DELETE CASCADE,
  pennylane_invoice_id text,
  pennylane_customer_id text,
  numero text,
  date_facture date,
  date_echeance date,
  montant_ht_cents integer,
  montant_tva_cents integer,
  montant_ttc_cents integer,
  devise text NOT NULL DEFAULT 'EUR',
  statut text NOT NULL DEFAULT 'brouillon',
  pdf_url text,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  source text NOT NULL DEFAULT 'stripe',
  erreur text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS factures_pennylane_invoice_id_key
  ON public.factures_pennylane (pennylane_invoice_id) WHERE pennylane_invoice_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS factures_pennylane_stripe_invoice_id_key
  ON public.factures_pennylane (stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS factures_pennylane_prestataire_idx
  ON public.factures_pennylane (prestataire_id, date_facture DESC);

GRANT SELECT ON public.factures_pennylane TO authenticated;
GRANT ALL ON public.factures_pennylane TO service_role;

ALTER TABLE public.factures_pennylane ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prestataire lit ses factures"
  ON public.factures_pennylane FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.prestataires p
    WHERE p.id = factures_pennylane.prestataire_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Admins lisent toutes les factures"
  ON public.factures_pennylane FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_factures_pennylane_updated_at
  BEFORE UPDATE ON public.factures_pennylane
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();