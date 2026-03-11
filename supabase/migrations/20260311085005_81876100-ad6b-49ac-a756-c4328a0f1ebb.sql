
-- Fix overly permissive INSERT policy on demandes_devis
-- Allow insert only when the prestataire is actif
DROP POLICY "Anyone can create demande" ON public.demandes_devis;
CREATE POLICY "Anyone can create demande for active prestataire" ON public.demandes_devis 
  FOR INSERT 
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.prestataires WHERE prestataires.id = demandes_devis.prestataire_id AND prestataires.statut = 'actif')
  );
