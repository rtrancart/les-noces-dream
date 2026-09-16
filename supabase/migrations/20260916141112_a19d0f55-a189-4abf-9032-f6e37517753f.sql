ALTER TABLE public.email_textes
  ADD COLUMN IF NOT EXISTS sous_objet text,
  ADD COLUMN IF NOT EXISTS destinataire text NOT NULL DEFAULT 'prestataire';

ALTER TABLE public.email_textes
  DROP CONSTRAINT IF EXISTS email_textes_destinataire_check;

ALTER TABLE public.email_textes
  ADD CONSTRAINT email_textes_destinataire_check
  CHECK (destinataire IN ('client', 'prestataire', 'equipe'));

UPDATE public.email_textes
SET destinataire = 'client'
WHERE template_name IN ('notif_reponse_client_avec_compte', 'notif_reponse_client_sans_compte');

UPDATE public.email_textes
SET destinataire = 'equipe'
WHERE template_name IN ('demande_reactivation', 'notif_nouvelle_soumission_fiche');
