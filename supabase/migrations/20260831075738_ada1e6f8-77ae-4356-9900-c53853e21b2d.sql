-- 1) Remise à zéro : aucune échéance tant que le compte n'est pas activé
UPDATE public.abonnements a
SET fin_essai_le = NULL
FROM public.prestataires p
WHERE p.id = a.prestataire_id
  AND p.origine = 'migration'::public.origine_prestataire
  AND p.compte_active_le IS NULL
  AND a.fin_essai_le IS NOT NULL
  AND a.stripe_subscription_id IS NULL;

-- 2) Trigger : 90 jours à partir de l'activation du compte
CREATE OR REPLACE FUNCTION public.set_fin_essai_migration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.origine = 'migration'::public.origine_prestataire
     AND NEW.user_id IS NOT NULL
     AND OLD.user_id IS NULL
     AND NEW.compte_active_le IS NOT NULL THEN
    UPDATE public.abonnements
    SET fin_essai_le = NEW.compte_active_le + INTERVAL '90 days',
        updated_at = now()
    WHERE prestataire_id = NEW.id
      AND fin_essai_le IS NULL;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_fin_essai_migration ON public.prestataires;
CREATE TRIGGER trg_set_fin_essai_migration
AFTER UPDATE OF user_id ON public.prestataires
FOR EACH ROW EXECUTE FUNCTION public.set_fin_essai_migration();

-- 3) Backfill des fiches migrées déjà activées
UPDATE public.abonnements a
SET fin_essai_le = p.compte_active_le + INTERVAL '90 days',
    updated_at = now()
FROM public.prestataires p
WHERE p.id = a.prestataire_id
  AND p.origine = 'migration'::public.origine_prestataire
  AND p.compte_active_le IS NOT NULL
  AND a.fin_essai_le IS NULL
  AND a.stripe_subscription_id IS NULL;