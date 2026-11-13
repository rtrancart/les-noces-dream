CREATE OR REPLACE FUNCTION public.brevo_compteurs_prestataires(p_limit integer DEFAULT 500, p_offset integer DEFAULT 0)
 RETURNS TABLE(prestataire_id uuid, email text, nb_vues integer, nb_demandes integer, nb_favoris integer, taux_reponse numeric, note_moyenne real, oppose boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH page AS (
    SELECT p.id, lower(trim(p.email_contact)) AS email, p.taux_reponse, p.note_moyenne
    FROM public.prestataires p
    WHERE p.email_contact IS NOT NULL AND trim(p.email_contact) <> ''
    ORDER BY p.id
    LIMIT p_limit OFFSET p_offset
  )
  SELECT
    page.id,
    page.email,
    COALESCE((SELECT count(*) FROM public.evenements_prestataire e
               WHERE e.prestataire_id = page.id AND e.type = 'vue_profil'), 0)::int,
    COALESCE((SELECT count(*) FROM public.demandes_devis d
               WHERE d.prestataire_id = page.id AND d.moderation = 'valide'), 0)::int,
    COALESCE((SELECT count(*) FROM public.favoris f
               WHERE f.prestataire_id = page.id), 0)::int,
    page.taux_reponse,
    round(page.note_moyenne::numeric, 1)::real,
    EXISTS (SELECT 1 FROM public.oppositions_marketing o WHERE o.email = page.email)
    OR EXISTS (SELECT 1 FROM public.suppressed_emails s
               WHERE lower(trim(s.email)) = page.email AND s.reason IN ('bounce','complaint'))
  FROM page
  ORDER BY page.id;
$function$;