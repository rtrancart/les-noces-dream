CREATE OR REPLACE FUNCTION public.prerender_calculer_priorite()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.statut = 'a_traiter' AND coalesce(NEW.priorite, 0) < 30 THEN
    NEW.priorite := (CASE
        WHEN NEW.storage_path IS NULL OR NEW.rendu_le IS NULL THEN 20
        WHEN NEW.signature_donnees_rendue IS DISTINCT FROM NEW.signature_donnees THEN 10
        ELSE 0 END) + public.prerender_priorite_type(NEW.page_type);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prerender_priorite ON public.prerender_queue;
CREATE TRIGGER trg_prerender_priorite
BEFORE INSERT OR UPDATE ON public.prerender_queue
FOR EACH ROW EXECUTE FUNCTION public.prerender_calculer_priorite();

CREATE OR REPLACE FUNCTION public.prerender_forcer_recapture(p_perimetre text, p_url_path text DEFAULT NULL::text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
         priorite = CASE WHEN p_perimetre = 'page' THEN 30 ELSE 0 END,
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

UPDATE public.prerender_queue SET priorite = 0 WHERE statut = 'a_traiter' AND priorite < 30;