-- Cleanup des données de test E2E (charte / prestataires)
-- Désactive temporairement le trigger d'immutabilité pour purger les signatures de test
ALTER TABLE public.signatures_charte DISABLE TRIGGER USER;

DELETE FROM public.signatures_charte
WHERE prestataire_id IN (
  SELECT id FROM public.prestataires
  WHERE email_contact LIKE '%@e2e.local'
     OR slug LIKE 'e2e-%'
     OR nom_commercial LIKE 'E2E %'
     OR nom_commercial LIKE 'Brouillon e2e-%'
);

ALTER TABLE public.signatures_charte ENABLE TRIGGER USER;

-- Supprime les prestataires de test
DELETE FROM public.prestataires
WHERE email_contact LIKE '%@e2e.local'
   OR slug LIKE 'e2e-%'
   OR nom_commercial LIKE 'E2E %'
   OR nom_commercial LIKE 'Brouillon e2e-%';

-- Supprime les utilisateurs auth de test (cascade vers profiles, user_roles)
DELETE FROM auth.users WHERE email LIKE '%@e2e.local';

-- Supprime les chartes de test éventuellement restantes
DELETE FROM public.chartes_versions WHERE numero_version LIKE 'T-e2e-charte-%';