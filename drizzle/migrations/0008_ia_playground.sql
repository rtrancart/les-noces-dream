CREATE TABLE public.ia_tarifs (
  model text PRIMARY KEY,
  prix_entree_eur_par_million numeric NULL,
  prix_sortie_eur_par_million numeric NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_tarifs TO authenticated;
GRANT ALL ON public.ia_tarifs TO service_role;
ALTER TABLE public.ia_tarifs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gèrent ia_tarifs" ON public.ia_tarifs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER ia_tarifs_updated_at BEFORE UPDATE ON public.ia_tarifs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.ia_tarifs(model) VALUES ('mistral-small-latest'),('claude-haiku-5-5') ON CONFLICT DO NOTHING;

CREATE TABLE public.ia_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  admin_id uuid NULL,
  provider text NOT NULL CHECK (provider IN ('mistral','anthropic')),
  model text NOT NULL,
  prompt_label text NULL CHECK (prompt_label IN ('A','B','C')),
  demande_numero text NULL,
  temperature numeric NULL,
  system text NULL,
  message text NOT NULL,
  reponse text NULL,
  erreur text NULL,
  tokens_entree integer NULL,
  tokens_sortie integer NULL,
  duree_ms integer NULL,
  note_pertinence smallint NULL CHECK (note_pertinence BETWEEN 1 AND 5),
  note_francais smallint NULL CHECK (note_francais BETWEEN 1 AND 5),
  note_regles smallint NULL CHECK (note_regles BETWEEN 1 AND 5),
  remarque text NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_tests TO authenticated;
GRANT ALL ON public.ia_tests TO service_role;
ALTER TABLE public.ia_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gèrent ia_tests" ON public.ia_tests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE INDEX ia_tests_created_at_idx ON public.ia_tests(created_at DESC);