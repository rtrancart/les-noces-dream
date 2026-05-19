
-- 1) Migration de données : prestataires déjà connectés → a_completer
UPDATE public.prestataires
SET statut = 'a_completer'::public.statut_prestataire
WHERE statut = 'pre_inscrit'::public.statut_prestataire
  AND premier_login_le IS NOT NULL;

-- 2) Verrou : interdire l'écriture directe du statut 'actif'
CREATE OR REPLACE FUNCTION public.prevent_direct_actif_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.statut = 'actif'::public.statut_prestataire
     AND (TG_OP = 'INSERT' OR OLD.statut IS DISTINCT FROM NEW.statut)
     AND COALESCE(current_setting('app.allow_actif_write', true), 'off') <> 'on' THEN
    RAISE EXCEPTION
      'Le statut actif ne peut être écrit que par les triggers on_charte_signed ou on_prestataire_validated';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_actif_write ON public.prestataires;
CREATE TRIGGER trg_prevent_direct_actif_write
BEFORE INSERT OR UPDATE OF statut ON public.prestataires
FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_actif_write();

-- 3) on_prestataire_validated (BEFORE UPDATE) : validee + charte signée → actif
CREATE OR REPLACE FUNCTION public.on_prestataire_validation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.statut = 'validee'::public.statut_prestataire
     AND NEW.charte_signee_le IS NOT NULL THEN
    PERFORM set_config('app.allow_actif_write', 'on', true);
    NEW.statut := 'actif'::public.statut_prestataire;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prestataire_validation_check ON public.prestataires;
CREATE TRIGGER prestataire_validation_check
BEFORE UPDATE ON public.prestataires
FOR EACH ROW EXECUTE FUNCTION public.on_prestataire_validation();

-- 4) on_charte_signed (AFTER INSERT) : si statut validee → bascule actif
CREATE OR REPLACE FUNCTION public.on_signature_charte_created()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_statut public.statut_prestataire;
BEGIN
  SELECT statut INTO v_statut FROM public.prestataires WHERE id = NEW.prestataire_id;

  IF v_statut = 'validee'::public.statut_prestataire THEN
    PERFORM set_config('app.allow_actif_write', 'on', true);
    UPDATE public.prestataires SET
      charte_signee_le      = NEW.signe_le,
      charte_version_signee = NEW.charte_numero_version,
      statut                = 'actif'::public.statut_prestataire
    WHERE id = NEW.prestataire_id;
  ELSE
    UPDATE public.prestataires SET
      charte_signee_le      = NEW.signe_le,
      charte_version_signee = NEW.charte_numero_version
    WHERE id = NEW.prestataire_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger déjà existant (trg_on_signature_charte_created) pointe sur cette fonction → OK

-- 5) Audit : journalisation des transitions de statut
CREATE OR REPLACE FUNCTION public.log_statut_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
BEGIN
  IF OLD.statut IS DISTINCT FROM NEW.statut THEN
    INSERT INTO public.logs_admin (admin_id, action, entite, entite_id, details)
    VALUES (
      COALESCE(v_admin, NEW.user_id, '00000000-0000-0000-0000-000000000000'::uuid),
      'statut_transition',
      'prestataires',
      NEW.id,
      jsonb_build_object(
        'ancien_statut', OLD.statut::text,
        'nouveau_statut', NEW.statut::text,
        'auto', v_admin IS NULL
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_statut_transition ON public.prestataires;
CREATE TRIGGER trg_log_statut_transition
AFTER UPDATE OF statut ON public.prestataires
FOR EACH ROW EXECUTE FUNCTION public.log_statut_transition();
