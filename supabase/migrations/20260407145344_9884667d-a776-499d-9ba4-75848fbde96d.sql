
CREATE OR REPLACE FUNCTION public.can_review_prestataire(p_prestataire_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.demandes_devis dd
    JOIN public.profiles p ON p.email = dd.email_contact
    WHERE dd.prestataire_id = p_prestataire_id
      AND p.id = auth.uid()
  )
$$;
