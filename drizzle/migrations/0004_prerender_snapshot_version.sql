-- Version globale du pré-rendu. À INCRÉMENTER à chaque modification d'un
-- composant global rendu dans le pré-rendu (footer, header/nav, layout, home).
-- Effet : toutes les empreintes changent ; le socle (accueil, régions,
-- catégories, blog, pages) est remis en file immédiatement à la prochaine
-- réconciliation, les fiches prestataires sont recapturées progressivement
-- par le rafraîchissement nocturne par l'âge.
CREATE OR REPLACE FUNCTION public.prerender_snapshot_version()
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$ SELECT '2'::text $$;
COMMENT ON FUNCTION public.prerender_snapshot_version() IS
  'SNAPSHOT_VERSION : à incrémenter à chaque modification d''un composant global rendu dans le pré-rendu (footer, header/nav, layout, home).';

ALTER TABLE public.prerender_queue
  ADD COLUMN IF NOT EXISTS signature_donnees text,
  ADD COLUMN IF NOT EXISTS signature_donnees_rendue text;

-- Jusqu'ici les empreintes étaient purement « données ».
UPDATE public.prerender_queue
   SET signature_donnees = signature_visible,
       signature_donnees_rendue = signature_rendue
 WHERE signature_donnees IS NULL;

CREATE OR REPLACE FUNCTION public.prerender_reconcilier(p_limit integer DEFAULT 1000, p_offset integer DEFAULT 0)
 RETURNS TABLE(traitees integer, ajoutees integer, remises integer, inchangees integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total integer := 0;
  v_ajout integer := 0;
  v_remise integer := 0;
  v_version text := public.prerender_snapshot_version();
BEGIN
  CREATE TEMP TABLE _pi ON COMMIT DROP AS
    SELECT pi.url_path, pi.page_type, pi.source_id,
           pi.signature AS sig_donnees,
           md5(pi.signature || '|v' || v_version) AS sig_visible
    FROM public.prerender_pages_indexables() pi
    ORDER BY pi.url_path
    OFFSET greatest(p_offset, 0) LIMIT greatest(p_limit, 1);

  SELECT count(*) INTO v_total FROM _pi;

  WITH ins AS (
    INSERT INTO public.prerender_queue (url_path, page_type, source_id, signature_visible, signature_donnees, statut, priorite)
    SELECT pi.url_path, pi.page_type, pi.source_id, pi.sig_visible, pi.sig_donnees, 'a_traiter',
           public.prerender_priorite_type(pi.page_type)
    FROM _pi pi
    ON CONFLICT (url_path) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_ajout FROM ins;

  -- Socle + fiches dont les DONNÉES ont changé : remise en file immédiate.
  WITH upd AS (
    UPDATE public.prerender_queue q
    SET signature_visible = pi.sig_visible,
        signature_donnees = pi.sig_donnees,
        page_type = pi.page_type,
        source_id = pi.source_id,
        statut = 'a_traiter',
        priorite = greatest(q.priorite, public.prerender_priorite_type(pi.page_type)),
        tentatives = 0,
        dernier_motif = NULL,
        dernier_status = NULL,
        updated_at = now()
    FROM _pi pi
    WHERE q.url_path = pi.url_path
      AND q.signature_visible IS DISTINCT FROM pi.sig_visible
      AND (pi.page_type <> 'prestataire'
           OR q.signature_donnees_rendue IS DISTINCT FROM pi.sig_donnees
           OR q.storage_path IS NULL)
    RETURNING 1
  ) SELECT count(*) INTO v_remise FROM upd;

  -- Fiches dont seule la VERSION a changé : empreinte mise à jour sans remise
  -- en file ; le rafraîchissement nocturne par l'âge les recapture par lots.
  UPDATE public.prerender_queue q
     SET signature_visible = pi.sig_visible,
         signature_donnees = pi.sig_donnees,
         updated_at = now()
    FROM _pi pi
   WHERE q.url_path = pi.url_path
     AND q.signature_visible IS DISTINCT FROM pi.sig_visible;

  RETURN QUERY SELECT v_total, v_ajout, v_remise, v_total - v_ajout - v_remise;
END;
$function$;

-- Rafraîchissement par l'âge : à âge égal de priorité, les snapshots d'une
-- ancienne version passent en premier.
CREATE OR REPLACE FUNCTION public.prerender_planifier_rafraichissement(p_limit integer, p_age interval)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  WITH cibles AS (
    SELECT id FROM public.prerender_queue
    WHERE statut = 'a_jour' AND storage_path IS NOT NULL
      AND (rendu_le IS NULL OR rendu_le < now() - p_age)
    ORDER BY public.prerender_priorite_type(page_type) DESC,
             (signature_visible IS DISTINCT FROM signature_rendue) DESC,
             rendu_le ASC NULLS FIRST
    LIMIT GREATEST(p_limit, 0)
  )
  UPDATE public.prerender_queue q
     SET statut = 'a_traiter', force_rendu = true, tentatives = 0,
         priorite = public.prerender_priorite_type(q.page_type), updated_at = now()
    FROM cibles WHERE q.id = cibles.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$;

-- Action admin « Forcer la recapture » : périmètre 'tout' | 'socle' | 'page'.
CREATE OR REPLACE FUNCTION public.prerender_forcer_recapture(p_perimetre text, p_url_path text DEFAULT NULL)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  IF p_perimetre NOT IN ('tout','socle','page') THEN
    RAISE EXCEPTION 'Périmètre inconnu : %', p_perimetre USING ERRCODE = '22023';
  END IF;
  IF p_perimetre = 'page' AND coalesce(trim(p_url_path),'') = '' THEN
    RAISE EXCEPTION 'Chemin de page requis' USING ERRCODE = '22023';
  END IF;

  UPDATE public.prerender_queue q
     SET statut = 'a_traiter', force_rendu = true, tentatives = 0,
         dernier_motif = NULL, dernier_status = NULL,
         priorite = CASE WHEN p_perimetre = 'page' THEN 10
                         ELSE public.prerender_priorite_type(q.page_type) END,
         updated_at = now()
   WHERE (p_perimetre = 'tout')
      OR (p_perimetre = 'socle' AND q.page_type IN ('statique','region','categorie','categorie_fille'))
      OR (p_perimetre = 'page' AND q.url_path = trim(p_url_path));
  GET DIAGNOSTICS n = ROW_COUNT;

  INSERT INTO public.logs_admin (admin_id, action, entite, details)
  VALUES (auth.uid(), 'prerender_forcer_recapture', 'prerender_queue',
          jsonb_build_object('perimetre', p_perimetre, 'url_path', p_url_path, 'pages', n));
  RETURN n;
END $function$;

REVOKE ALL ON FUNCTION public.prerender_forcer_recapture(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prerender_forcer_recapture(text, text) TO authenticated, service_role;