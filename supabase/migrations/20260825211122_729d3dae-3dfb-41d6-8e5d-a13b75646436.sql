ALTER TABLE public.prestataires
  ADD COLUMN IF NOT EXISTS migration_m01_envoye_le timestamptz,
  ADD COLUMN IF NOT EXISTS migration_m02_envoye_le timestamptz,
  ADD COLUMN IF NOT EXISTS migration_m03_envoye_le timestamptz,
  ADD COLUMN IF NOT EXISTS migration_m04_envoye_le timestamptz,
  ADD COLUMN IF NOT EXISTS migration_m05_envoye_le timestamptz;

-- Index partiels calqués sur la sélection des crons (M-02/03/04 : jamais connecté ;
-- M-05 : connecté, charte non signée).
CREATE INDEX IF NOT EXISTS idx_presta_migration_m02_pending
  ON public.prestataires (magic_link_envoye_le)
  WHERE origine = 'migration'::public.origine_prestataire
    AND premier_login_le IS NULL
    AND migration_m02_envoye_le IS NULL;

CREATE INDEX IF NOT EXISTS idx_presta_migration_m03_pending
  ON public.prestataires (magic_link_envoye_le)
  WHERE origine = 'migration'::public.origine_prestataire
    AND premier_login_le IS NULL
    AND migration_m03_envoye_le IS NULL;

CREATE INDEX IF NOT EXISTS idx_presta_migration_m04_pending
  ON public.prestataires (magic_link_envoye_le)
  WHERE origine = 'migration'::public.origine_prestataire
    AND premier_login_le IS NULL
    AND migration_m04_envoye_le IS NULL;

CREATE INDEX IF NOT EXISTS idx_presta_migration_m05_pending
  ON public.prestataires (premier_login_le)
  WHERE origine = 'migration'::public.origine_prestataire
    AND charte_signee_le IS NULL
    AND migration_m05_envoye_le IS NULL;