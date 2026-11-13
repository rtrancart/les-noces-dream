CREATE OR REPLACE FUNCTION public.prestataire_est_actif(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.prestataires WHERE id = _id AND statut = 'actif')
$$;
GRANT EXECUTE ON FUNCTION public.prestataire_est_actif(uuid) TO anon, authenticated;

-- Écrits uniquement par les Edge Functions (service_role)
DROP POLICY IF EXISTS "Anyone can insert contact" ON public.contacts_anonymes;
DROP POLICY IF EXISTS "Anyone can insert sessions" ON public.sessions_fiche;

-- Événements : seulement des types connus, sur une fiche active
DROP POLICY IF EXISTS "Anyone can insert events" ON public.evenements_prestataire;
CREATE POLICY "Public can insert known events on active prestataires"
ON public.evenements_prestataire FOR INSERT TO anon, authenticated
WITH CHECK (
  type IN ('vue_profil','premier_contact')
  AND public.prestataire_est_actif(prestataire_id)
);

-- Vidéos : publiques seulement pour les fiches actives, sinon propriétaire/admin
DROP POLICY IF EXISTS "Public can view prestataires videos rows" ON public.prestataires_videos;
CREATE POLICY "Public can view videos of active prestataires"
ON public.prestataires_videos FOR SELECT TO anon, authenticated
USING (
  public.prestataire_est_actif(prestataire_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.prestataires p WHERE p.id = prestataires_videos.prestataire_id AND p.user_id = auth.uid())
);