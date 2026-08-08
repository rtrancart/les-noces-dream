DELETE FROM public.brevo_sync_log WHERE demande_id IN (SELECT id FROM public.demandes_devis WHERE email_contact LIKE '%lovable@lesnoces.test');
DELETE FROM public.brevo_sync_log WHERE prestataire_id = '081199da-c7da-4a3a-ac93-4bf80adfddc8';
DELETE FROM public.demandes_devis WHERE email_contact LIKE '%lovable@lesnoces.test';
DELETE FROM public.contacts_anonymes WHERE email LIKE '%lovable@lesnoces.test';
DELETE FROM public.prestataires WHERE id = '081199da-c7da-4a3a-ac93-4bf80adfddc8';
DELETE FROM public.suppressed_emails WHERE email LIKE '%lovable@lesnoces.test';