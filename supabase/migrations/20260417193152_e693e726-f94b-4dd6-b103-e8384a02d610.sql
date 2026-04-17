-- Table pour stocker les textes éditables des templates d'email
-- Les templates React Email lisent ces textes via la fonction send-transactional-email
CREATE TABLE public.email_textes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  sujet text NOT NULL,
  titre text,
  intro text,
  corps text,
  cta_label text,
  footer text,
  est_actif boolean NOT NULL DEFAULT true,
  variables_disponibles text[] DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.email_textes ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent gérer les textes
CREATE POLICY "Admins can manage email textes"
ON public.email_textes
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Lecture par tous (l'Edge Function utilise service_role donc bypass RLS, mais on garde safe)
CREATE POLICY "Public can read active email textes"
ON public.email_textes
FOR SELECT
USING (est_actif = true);

CREATE TRIGGER update_email_textes_updated_at
BEFORE UPDATE ON public.email_textes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed des 4 templates de messagerie
INSERT INTO public.email_textes (template_name, display_name, description, sujet, titre, intro, corps, cta_label, footer, variables_disponibles) VALUES
(
  'notif_nouveau_contact_presta',
  'Nouveau contact (prestataire)',
  'Envoyé au prestataire quand un visiteur soumet une demande de devis depuis sa fiche.',
  'Nouvelle demande de devis de {{clientNom}}',
  'Nouvelle demande de devis',
  'Bonjour {{prestataireNom}}, vous avez reçu une nouvelle demande de devis via votre fiche LesNoces.net.',
  NULL,
  'Répondre au client',
  'Connectez-vous à votre espace pro pour répondre directement depuis la messagerie.',
  ARRAY['prestataireNom', 'clientNom', 'clientEmail', 'clientTelephone', 'objet', 'message', 'dateEvenement', 'lieuEvenement', 'lienDemande']
),
(
  'notif_reponse_client_avec_compte',
  'Réponse prestataire (client connecté)',
  'Envoyé au client connecté quand le prestataire répond dans le fil de discussion.',
  '{{prestataireNom}} vous a répondu',
  'Vous avez une nouvelle réponse',
  'Bonjour {{clientPrenom}},',
  '{{prestataireNom}} vient de vous répondre concernant votre demande de devis.',
  'Lire et répondre',
  'Retrouvez l''historique complet de votre conversation dans votre espace personnel.',
  ARRAY['clientPrenom', 'prestataireNom', 'messageExtrait', 'lienMessagerie']
),
(
  'notif_reponse_client_sans_compte',
  'Réponse prestataire (client sans compte)',
  'Envoyé au client anonyme quand le prestataire répond. Inclut un lien magique vers le fil de discussion.',
  '{{prestataireNom}} vous a répondu',
  'Vous avez une nouvelle réponse',
  'Bonjour {{clientPrenom}},',
  '{{prestataireNom}} vient de répondre à votre demande de devis.',
  'Lire et répondre',
  'Vous avez reçu cet email car vous avez contacté un prestataire via LesNoces.net.',
  ARRAY['clientPrenom', 'prestataireNom', 'messageExtrait', 'lienMagique', 'lienInscription']
),
(
  'notif_reponse_presta',
  'Réponse client (prestataire)',
  'Envoyé au prestataire quand un client répond dans le fil de discussion.',
  'Nouveau message de {{clientNom}}',
  'Nouvelle réponse client',
  'Bonjour {{prestataireNom}},',
  '{{clientNom}} vient de vous répondre dans la messagerie.',
  'Répondre dans la messagerie',
  'Une réponse rapide augmente significativement vos chances de conversion.',
  ARRAY['prestataireNom', 'clientNom', 'messageExtrait', 'lienMessagerie']
);