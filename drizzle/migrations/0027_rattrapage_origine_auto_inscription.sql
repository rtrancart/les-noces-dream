ALTER TABLE public.prestataires DISABLE TRIGGER trg_prestataires_origine_immutable;

UPDATE public.prestataires p
SET origine = 'auto_inscription'
FROM auth.users u
WHERE p.user_id = u.id
  AND p.origine = 'inscription_admin'
  AND u.raw_user_meta_data->>'role_souhaite' = 'prestataire'
  AND p.cree_par_admin = false
  AND p.statut <> 'suspendu'
  AND p.created_at < '2026-11-17 14:45:00+00'
  AND NOT EXISTS (
    SELECT 1 FROM public.logs_admin l
    WHERE l.entite = 'prestataires' AND l.entite_id = p.id
      AND l.action IN ('invitation_envoyee', 'invitation_acceptee', 'bulk_validate_invite')
  );

ALTER TABLE public.prestataires ENABLE TRIGGER trg_prestataires_origine_immutable;

UPDATE public.prestataires p
SET cree_par_admin = true
WHERE p.origine = 'inscription_admin'
  AND p.cree_par_admin = false
  AND p.statut = 'a_completer'
  AND EXISTS (
    SELECT 1 FROM public.logs_admin l
    WHERE l.entite = 'prestataires' AND l.entite_id = p.id
      AND l.action = 'invitation_envoyee'
  );