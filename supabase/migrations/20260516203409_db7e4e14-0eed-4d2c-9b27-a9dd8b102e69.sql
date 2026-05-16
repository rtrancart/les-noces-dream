-- ---------------------------------------------------------------------
-- 1.5  motif_suspension : création enum + conversion colonne
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'motif_suspension_enum') THEN
    CREATE TYPE public.motif_suspension_enum AS ENUM (
      'non_paiement',
      'admin',
      'archive',
      'charte_non_signee',
      'charte_obsolete'
    );
  END IF;
END$$;

ALTER TABLE public.prestataires
  ALTER COLUMN motif_suspension TYPE public.motif_suspension_enum
  USING motif_suspension::public.motif_suspension_enum;

-- ---------------------------------------------------------------------
-- 1.1  Table chartes_versions
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chartes_versions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_version        text NOT NULL UNIQUE,
  titre                 text NOT NULL,
  contenu_html          text NOT NULL,
  contenu_hash          text NOT NULL,
  pdf_url               text,
  entree_en_vigueur_le  timestamptz NOT NULL,
  archivee_le           timestamptz,
  cree_par              uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_charte_active
  ON public.chartes_versions (archivee_le)
  WHERE archivee_le IS NULL;

-- ---------------------------------------------------------------------
-- 1.2  Table signatures_charte
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.signatures_charte (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestataire_id                uuid NOT NULL REFERENCES public.prestataires(id) ON DELETE CASCADE,
  profile_id                    uuid NOT NULL REFERENCES public.profiles(id)     ON DELETE CASCADE,
  charte_version_id             uuid NOT NULL REFERENCES public.chartes_versions(id),
  charte_numero_version         text NOT NULL,
  charte_hash                   text NOT NULL,
  signe_le                      timestamptz NOT NULL DEFAULT now(),
  ip_signataire                 inet,
  user_agent                    text NOT NULL,
  methode_auth                  text NOT NULL,
  email_confirmation_envoye_le  timestamptz,
  pdf_preuve_url                text,
  created_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signatures_charte_prestataire
  ON public.signatures_charte (prestataire_id);
CREATE INDEX IF NOT EXISTS idx_signatures_charte_profile
  ON public.signatures_charte (profile_id);

-- ---------------------------------------------------------------------
-- 1.3  Colonnes prestataires
-- ---------------------------------------------------------------------
ALTER TABLE public.prestataires
  ADD COLUMN IF NOT EXISTS charte_signee_le        timestamptz,
  ADD COLUMN IF NOT EXISTS charte_version_signee   text,
  ADD COLUMN IF NOT EXISTS premier_login_le        timestamptz,
  ADD COLUMN IF NOT EXISTS magic_link_envoye_le    timestamptz,
  ADD COLUMN IF NOT EXISTS magic_link_ouvert       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS relances_envoyees       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archivage_reporte_a     timestamptz,
  ADD COLUMN IF NOT EXISTS notes_pre_inscription   text;

-- ---------------------------------------------------------------------
-- 1.4  Colonne profiles
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cgu_version_acceptee text;

-- ---------------------------------------------------------------------
-- 2.1  Trigger immuabilité signatures
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_signature_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Les signatures sont immuables (art. 11 Charte, convention de preuve).';
END;
$$;

DROP TRIGGER IF EXISTS signatures_charte_immutable ON public.signatures_charte;
CREATE TRIGGER signatures_charte_immutable
BEFORE UPDATE OR DELETE ON public.signatures_charte
FOR EACH ROW EXECUTE FUNCTION public.prevent_signature_modification();

-- ---------------------------------------------------------------------
-- 2.2  Trigger immuabilité versions archivées
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_archived_version_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.archivee_le IS NOT NULL THEN
    IF NEW.contenu_html != OLD.contenu_html OR NEW.contenu_hash != OLD.contenu_hash THEN
      RAISE EXCEPTION 'Le contenu d''une version archivee ne peut etre modifie.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chartes_versions_archive_lock ON public.chartes_versions;
CREATE TRIGGER chartes_versions_archive_lock
BEFORE UPDATE ON public.chartes_versions
FOR EACH ROW EXECUTE FUNCTION public.prevent_archived_version_modification();

-- ---------------------------------------------------------------------
-- 2.3  Trigger publication automatique après signature
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_signature_charte_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.prestataires SET
    charte_signee_le      = NEW.signe_le,
    charte_version_signee = NEW.charte_numero_version,
    statut = CASE WHEN statut = 'validee'::public.statut_prestataire
      THEN 'actif'::public.statut_prestataire ELSE statut END
  WHERE id = NEW.prestataire_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_signature_charte_created ON public.signatures_charte;
CREATE TRIGGER trg_on_signature_charte_created
AFTER INSERT ON public.signatures_charte
FOR EACH ROW EXECUTE FUNCTION public.on_signature_charte_created();

-- ---------------------------------------------------------------------
-- 2.4  Trigger validation automatique inverse
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_prestataire_validation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.statut = 'validee'::public.statut_prestataire AND NEW.charte_signee_le IS NOT NULL THEN
    NEW.statut := 'actif'::public.statut_prestataire;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prestataire_validation_check ON public.prestataires;
CREATE TRIGGER prestataire_validation_check
BEFORE UPDATE ON public.prestataires
FOR EACH ROW
WHEN (OLD.statut IS DISTINCT FROM NEW.statut AND NEW.statut = 'validee'::public.statut_prestataire)
EXECUTE FUNCTION public.on_prestataire_validation();

-- ---------------------------------------------------------------------
-- 2.5  RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.chartes_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active charte version"    ON public.chartes_versions;
DROP POLICY IF EXISTS "Admins can view all chartes versions"     ON public.chartes_versions;
DROP POLICY IF EXISTS "Super admins can manage chartes versions" ON public.chartes_versions;

CREATE POLICY "Public can view active charte version"
ON public.chartes_versions
FOR SELECT
USING (archivee_le IS NULL);

CREATE POLICY "Admins can view all chartes versions"
ON public.chartes_versions
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can manage chartes versions"
ON public.chartes_versions
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

ALTER TABLE public.signatures_charte ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Prestataire can view own signatures" ON public.signatures_charte;
DROP POLICY IF EXISTS "Admins can view all signatures"      ON public.signatures_charte;
DROP POLICY IF EXISTS "Service role can insert signatures"  ON public.signatures_charte;

CREATE POLICY "Prestataire can view own signatures"
ON public.signatures_charte
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.prestataires p
  WHERE p.id = signatures_charte.prestataire_id
    AND p.user_id = auth.uid()
));

CREATE POLICY "Admins can view all signatures"
ON public.signatures_charte
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Service role can insert signatures"
ON public.signatures_charte
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------
-- Storage buckets privés
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('chartes-officielles', 'chartes-officielles', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures-preuve', 'signatures-preuve', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins can manage chartes-officielles" ON storage.objects;
CREATE POLICY "Admins can manage chartes-officielles"
ON storage.objects
FOR ALL
USING (bucket_id = 'chartes-officielles'
   AND (public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'super_admin'::app_role)))
WITH CHECK (bucket_id = 'chartes-officielles'
   AND (public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'super_admin'::app_role)));

DROP POLICY IF EXISTS "Prestataire can read own signature pdf" ON storage.objects;
CREATE POLICY "Prestataire can read own signature pdf"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'signatures-preuve'
  AND EXISTS (
    SELECT 1 FROM public.prestataires p
    WHERE p.user_id = auth.uid()
      AND (storage.foldername(name))[1] = p.id::text
  )
);

DROP POLICY IF EXISTS "Admins can read signatures-preuve" ON storage.objects;
CREATE POLICY "Admins can read signatures-preuve"
ON storage.objects
FOR SELECT
USING (bucket_id = 'signatures-preuve'
   AND (public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'super_admin'::app_role)));