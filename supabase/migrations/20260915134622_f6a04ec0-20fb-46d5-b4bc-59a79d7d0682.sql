ALTER TABLE public.abonnements DROP CONSTRAINT abonnements_prestataire_id_fkey;
ALTER TABLE public.abonnements ADD CONSTRAINT abonnements_prestataire_id_fkey FOREIGN KEY (prestataire_id) REFERENCES public.prestataires(id) ON DELETE CASCADE;

ALTER TABLE public.avis DROP CONSTRAINT avis_prestataire_id_fkey;
ALTER TABLE public.avis ADD CONSTRAINT avis_prestataire_id_fkey FOREIGN KEY (prestataire_id) REFERENCES public.prestataires(id) ON DELETE CASCADE;

ALTER TABLE public.boosts_visibilite DROP CONSTRAINT boosts_visibilite_prestataire_id_fkey;
ALTER TABLE public.boosts_visibilite ADD CONSTRAINT boosts_visibilite_prestataire_id_fkey FOREIGN KEY (prestataire_id) REFERENCES public.prestataires(id) ON DELETE CASCADE;

ALTER TABLE public.demandes_devis DROP CONSTRAINT demandes_devis_prestataire_id_fkey;
ALTER TABLE public.demandes_devis ADD CONSTRAINT demandes_devis_prestataire_id_fkey FOREIGN KEY (prestataire_id) REFERENCES public.prestataires(id) ON DELETE CASCADE;

ALTER TABLE public.messages DROP CONSTRAINT messages_demande_id_fkey;
ALTER TABLE public.messages ADD CONSTRAINT messages_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES public.demandes_devis(id) ON DELETE CASCADE;

ALTER TABLE public.avis DROP CONSTRAINT avis_demande_id_fkey;
ALTER TABLE public.avis ADD CONSTRAINT avis_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES public.demandes_devis(id) ON DELETE SET NULL;