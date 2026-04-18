-- Table historique_navigation
CREATE TABLE public.historique_navigation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prestataire_id uuid NOT NULL REFERENCES public.prestataires(id) ON DELETE CASCADE,
  consulte_le timestamptz NOT NULL DEFAULT now(),
  nb_consultations integer NOT NULL DEFAULT 1,
  CONSTRAINT historique_navigation_unique UNIQUE (user_id, prestataire_id)
);

CREATE INDEX idx_historique_navigation_user_date
  ON public.historique_navigation (user_id, consulte_le DESC);

ALTER TABLE public.historique_navigation ENABLE ROW LEVEL SECURITY;

-- RLS : user-only (admins exclus volontairement — donnée privée)
CREATE POLICY "Users can view own historique"
  ON public.historique_navigation FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own historique"
  ON public.historique_navigation FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own historique"
  ON public.historique_navigation FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own historique"
  ON public.historique_navigation FOR DELETE
  USING (auth.uid() = user_id);

-- Fonction d'upsert avec cap à 20 entrées (FIFO)
CREATE OR REPLACE FUNCTION public.enregistrer_consultation_prestataire(p_prestataire_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.historique_navigation (user_id, prestataire_id, consulte_le, nb_consultations)
  VALUES (v_user_id, p_prestataire_id, now(), 1)
  ON CONFLICT (user_id, prestataire_id)
  DO UPDATE SET
    consulte_le = now(),
    nb_consultations = public.historique_navigation.nb_consultations + 1;

  -- FIFO : ne garder que les 20 dernières
  DELETE FROM public.historique_navigation
  WHERE user_id = v_user_id
    AND id NOT IN (
      SELECT id FROM public.historique_navigation
      WHERE user_id = v_user_id
      ORDER BY consulte_le DESC
      LIMIT 20
    );
END;
$$;

-- Fonction de purge RGPD (90 jours)
CREATE OR REPLACE FUNCTION public.purger_historique_navigation()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.historique_navigation
  WHERE consulte_le < now() - INTERVAL '90 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;