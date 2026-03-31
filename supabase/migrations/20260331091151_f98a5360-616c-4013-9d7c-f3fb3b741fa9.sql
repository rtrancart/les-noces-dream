
CREATE TABLE public.evenements_prestataire (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestataire_id uuid NOT NULL REFERENCES public.prestataires(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('vue_profil', 'premier_contact', 'affichage_telephone')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.evenements_prestataire ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view own events" ON public.evenements_prestataire
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM prestataires WHERE prestataires.id = evenements_prestataire.prestataire_id AND prestataires.user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Anyone can insert events" ON public.evenements_prestataire
FOR INSERT TO public
WITH CHECK (true);

CREATE INDEX idx_evenements_prestataire_lookup ON public.evenements_prestataire(prestataire_id, type, created_at);
