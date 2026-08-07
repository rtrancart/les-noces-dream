-- 1) Résolution du libellé canonique d'une région (clé dé-hyphénée, sans accents)
CREATE OR REPLACE FUNCTION public.normaliser_cle_zone(p_valeur text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
           translate(
             lower(trim(coalesce(p_valeur, ''))),
             'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ',
             'aaaaaaceeeeiiiinooooouuuuyy'
           ),
           '[^a-z0-9]', '', 'g'
         )
$$;

CREATE OR REPLACE FUNCTION public.resoudre_region_label(p_region text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT z.label
  FROM public.zones_reference z
  WHERE z.type IN ('region', 'dom', 'pays')
    AND public.normaliser_cle_zone(z.slug) = public.normaliser_cle_zone(p_region)
    AND public.normaliser_cle_zone(p_region) <> ''
  LIMIT 1
$$;

-- 2) Journal de synchronisation Brevo (aucune donnée personnelle)
CREATE TABLE public.brevo_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demande_id uuid NOT NULL REFERENCES public.demandes_devis(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'contact_submitted',
  statut text NOT NULL DEFAULT 'a_rejouer' CHECK (statut IN ('a_rejouer', 'reussi', 'abandonne')),
  tentatives integer NOT NULL DEFAULT 0,
  dernier_motif text,
  dernier_status integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX brevo_sync_log_demande_kind_key ON public.brevo_sync_log (demande_id, kind);
CREATE INDEX brevo_sync_log_a_rejouer_idx ON public.brevo_sync_log (created_at) WHERE statut = 'a_rejouer';

GRANT SELECT ON public.brevo_sync_log TO authenticated;
GRANT ALL ON public.brevo_sync_log TO service_role;

ALTER TABLE public.brevo_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins consultent le journal de synchro Brevo"
ON public.brevo_sync_log
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);