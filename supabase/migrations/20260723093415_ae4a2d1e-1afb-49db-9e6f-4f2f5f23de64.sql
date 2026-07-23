CREATE OR REPLACE FUNCTION public.prevent_direct_exemption_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.charte_exemptee_jusqua IS NOT NULL
       AND COALESCE(current_setting('app.allow_exemption_write', true), 'off') <> 'on' THEN
      RAISE EXCEPTION 'charte_exemptee_jusqua ne peut être posée que par un script de migration autorisé (flag app.allow_exemption_write).';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.charte_exemptee_jusqua IS NOT DISTINCT FROM OLD.charte_exemptee_jusqua THEN
    RETURN NEW;
  END IF;

  IF OLD.charte_exemptee_jusqua IS NOT NULL THEN
    RAISE EXCEPTION 'charte_exemptee_jusqua est immuable une fois posée : une exemption ne peut être ni modifiée, ni renouvelée, ni effacée.';
  END IF;

  IF COALESCE(current_setting('app.allow_exemption_write', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'charte_exemptee_jusqua ne peut être posée que par un script de migration autorisé (flag app.allow_exemption_write).';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_exemption_write ON public.prestataires;
CREATE TRIGGER trg_prevent_direct_exemption_write
  BEFORE INSERT OR UPDATE OF charte_exemptee_jusqua ON public.prestataires
  FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_exemption_write();