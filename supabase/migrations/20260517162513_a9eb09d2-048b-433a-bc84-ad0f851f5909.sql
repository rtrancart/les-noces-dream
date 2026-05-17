ALTER TABLE public.signatures_charte DISABLE TRIGGER USER;
DELETE FROM public.signatures_charte
WHERE charte_version_id IN (SELECT id FROM public.chartes_versions WHERE numero_version LIKE 'T-e2e-%');
ALTER TABLE public.signatures_charte ENABLE TRIGGER USER;

DELETE FROM public.chartes_versions WHERE numero_version LIKE 'T-e2e-%';

INSERT INTO public.chartes_versions (numero_version, titre, contenu_html, contenu_hash, entree_en_vigueur_le)
SELECT
  'v1.0',
  'Charte Qualité LesNoces.net',
  '<h2>Article 1 - Engagement</h2><p>Le prestataire s''engage à fournir un service de qualité conforme aux standards LesNoces.net.</p><h2>Article 2 - Transparence des prix</h2><p>Les prix affichés doivent être clairs et sans frais cachés.</p><h2>Article 3 - Délais de réponse</h2><p>Le prestataire s''engage à répondre aux demandes dans un délai maximum de 48h.</p><h2>Article 4 - Respect du client</h2><p>Le prestataire s''engage à respecter les engagements pris avec ses clients.</p><h2>Article 11 - Convention de preuve</h2><p>La signature électronique de la présente Charte a la même valeur qu''une signature manuscrite (art. 1366 du Code civil).</p>',
  encode(sha256('v1.0 charte LesNoces.net 2026'::bytea), 'hex'),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.chartes_versions WHERE archivee_le IS NULL
);