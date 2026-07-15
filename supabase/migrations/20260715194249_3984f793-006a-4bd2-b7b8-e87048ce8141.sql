
ALTER TABLE public.abonnements
  ADD COLUMN IF NOT EXISTS premier_echec_le TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rappel_impaye_envoye_le TIMESTAMPTZ;

INSERT INTO public.email_textes (template_name, display_name, description, sujet, variables_disponibles, est_actif)
VALUES
  (
    'impaye_premier_echec',
    'Impayé — 1er échec de paiement',
    'Envoyé au tout premier échec de prélèvement Stripe. Ton informatif, invite à mettre à jour le moyen de paiement.',
    'Votre paiement n''a pas pu être prélevé',
    ARRAY['prenom', 'nom_commercial', 'portail_url'],
    true
  ),
  (
    'impaye_rappel_intermediaire',
    'Impayé — rappel intermédiaire (J+7)',
    'Envoyé une seule fois environ 7 jours après le premier échec, si l''abonnement est toujours impayé. Ton plus ferme.',
    'Rappel : votre abonnement est toujours impayé',
    ARRAY['prenom', 'nom_commercial', 'portail_url'],
    true
  ),
  (
    'impaye_suspension',
    'Impayé — suspension définitive de la fiche',
    'Envoyé une seule fois quand Stripe abandonne définitivement l''abonnement après épuisement des retries. Explique comment réactiver.',
    'Votre fiche a été suspendue faute de paiement',
    ARRAY['prenom', 'nom_commercial', 'reactivation_url'],
    true
  )
ON CONFLICT (template_name) DO NOTHING;
