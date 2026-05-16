
-- Colonnes complémentaires pour Phase 6 bis
ALTER TABLE public.prestataires
  ADD COLUMN IF NOT EXISTS notification_charte_obsolete_envoyee_le timestamptz,
  ADD COLUMN IF NOT EXISTS demande_reactivation_le timestamptz,
  ADD COLUMN IF NOT EXISTS demande_reactivation_message text;

-- Index pour les crons
CREATE INDEX IF NOT EXISTS idx_prestataires_pre_inscrit_archivage
  ON public.prestataires(premier_login_le, charte_signee_le, archivage_reporte_a)
  WHERE statut = 'pre_inscrit'::statut_prestataire;

CREATE INDEX IF NOT EXISTS idx_prestataires_charte_obsolete
  ON public.prestataires(notification_charte_obsolete_envoyee_le, charte_version_signee)
  WHERE statut = 'actif'::statut_prestataire;
