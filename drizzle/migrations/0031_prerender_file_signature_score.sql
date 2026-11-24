
CREATE OR REPLACE FUNCTION public.prerender_priorite_base(p_type text, p_source uuid)
RETURNS smallint LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (CASE
    WHEN p_type = 'statique' THEN 900
    WHEN p_type IN ('categorie','categorie_fille') THEN 800
    WHEN p_type = 'region' THEN 700
    WHEN p_type IN ('article_blog','page_contenu') THEN 600
    ELSE coalesce((
      SELECT (CASE WHEN ((p.photo_principale_url IS NOT NULL)::int + coalesce(cardinality(p.urls_galerie),0)) >= 3
                    AND coalesce(length(p.description),0) >= 300 THEN 200 ELSE 100 END)
             + least(99, greatest(0, round(coalesce(p.score_classement,0))))::int
      FROM public.prestataires p WHERE p.id = p_source), 100)
  END)::smallint
$$;

CREATE OR REPLACE FUNCTION public.prerender_calculer_priorite()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  -- Remise en file dès que le contenu visible diffère du rendu (quelle que soit l'origine de l'UPDATE).
  IF TG_OP = 'UPDATE' AND NEW.statut = 'a_jour'
     AND NEW.signature_visible IS DISTINCT FROM OLD.signature_visible
     AND NEW.signature_visible IS DISTINCT FROM NEW.signature_rendue THEN
    NEW.statut := 'a_traiter';
    NEW.tentatives := 0;
  END IF;
  IF NEW.statut = 'a_traiter' AND coalesce(NEW.priorite, 0) < 2000 THEN
    NEW.priorite := (CASE WHEN NEW.storage_path IS NULL OR NEW.rendu_le IS NULL THEN 1000 ELSE 0 END)
                    + public.prerender_priorite_base(NEW.page_type, NEW.source_id);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.prerender_planifier_rafraichissement(p_limit integer, p_age interval)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n1 integer; n2 integer;
BEGIN
  -- Socle : chaque nuit.
  UPDATE public.prerender_queue SET statut='a_traiter', force_rendu=true, tentatives=0, updated_at=now()
   WHERE statut='a_jour' AND page_type IN ('statique','region','categorie','categorie_fille');
  GET DIAGNOSTICS n1 = ROW_COUNT;
  -- Filet de sécurité : snapshots trop anciens, plafonné.
  WITH cibles AS (
    SELECT id FROM public.prerender_queue
     WHERE statut='a_jour' AND page_type NOT IN ('statique','region','categorie','categorie_fille')
       AND (rendu_le IS NULL OR rendu_le < now() - p_age)
     ORDER BY rendu_le ASC NULLS FIRST LIMIT GREATEST(p_limit,0))
  UPDATE public.prerender_queue q SET statut='a_traiter', force_rendu=true, tentatives=0, updated_at=now()
    FROM cibles WHERE q.id = cibles.id;
  GET DIAGNOSTICS n2 = ROW_COUNT;
  RETURN n1 + n2;
END $$;

CREATE OR REPLACE FUNCTION public.prerender_reconcilier(p_limit integer DEFAULT 1000, p_offset integer DEFAULT 0)
RETURNS TABLE(traitees integer, ajoutees integer, remises integer, inchangees integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_total integer := 0; v_ajout integer := 0; v_remise integer := 0;
  v_version text := public.prerender_snapshot_version();
BEGIN
  CREATE TEMP TABLE _pi ON COMMIT DROP AS
    SELECT pi.url_path, pi.page_type, pi.source_id, pi.signature AS sig_donnees,
           md5(pi.signature || '|v' || v_version) AS sig_visible
    FROM public.prerender_pages_indexables() pi
    ORDER BY pi.url_path OFFSET greatest(p_offset,0) LIMIT greatest(p_limit,1);
  SELECT count(*) INTO v_total FROM _pi;

  WITH ins AS (
    INSERT INTO public.prerender_queue (url_path, page_type, source_id, signature_visible, signature_donnees, statut)
    SELECT url_path, page_type, source_id, sig_visible, sig_donnees, 'a_traiter' FROM _pi
    ON CONFLICT (url_path) DO NOTHING RETURNING 1
  ) SELECT count(*) INTO v_ajout FROM ins;

  -- Signatures recalculées ; le trigger remet en file si signature_visible ≠ signature_rendue.
  WITH upd AS (
    UPDATE public.prerender_queue q
       SET signature_visible = pi.sig_visible, signature_donnees = pi.sig_donnees,
           page_type = pi.page_type, source_id = pi.source_id, updated_at = now()
      FROM _pi pi
     WHERE q.url_path = pi.url_path AND q.signature_visible IS DISTINCT FROM pi.sig_visible
    RETURNING (pi.sig_visible IS DISTINCT FROM q.signature_rendue) AS remise
  ) SELECT count(*) FILTER (WHERE remise) INTO v_remise FROM upd;

  RETURN QUERY SELECT v_total, v_ajout, v_remise, v_total - v_ajout - v_remise;
END $$;

-- Recapture manuelle d'une page : niveau ≥ 2000 conservé par le trigger.
CREATE OR REPLACE FUNCTION public.prerender_forcer_recapture(p_perimetre text, p_url_path text DEFAULT NULL::text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
     SET statut='a_traiter', force_rendu=true, tentatives=0, dernier_motif=NULL, dernier_status=NULL,
         priorite = CASE WHEN p_perimetre='page' THEN 2000 ELSE 0 END, updated_at=now()
   WHERE (p_perimetre='tout')
      OR (p_perimetre='socle' AND q.page_type IN ('statique','region','categorie','categorie_fille'))
      OR (p_perimetre='page' AND q.url_path = trim(p_url_path));
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO public.logs_admin (admin_id, action, entite, details)
  VALUES (auth.uid(), 'prerender_forcer_recapture', 'prerender_queue',
          jsonb_build_object('perimetre', p_perimetre, 'url_path', p_url_path, 'pages', n));
  RETURN n;
END $$;

-- Publication d'une fiche : entrée immédiate en file.
CREATE OR REPLACE FUNCTION public.prerender_fiche_publiee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.statut = 'actif' AND NEW.slug IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.statut IS DISTINCT FROM 'actif' OR OLD.slug IS DISTINCT FROM NEW.slug) THEN
    BEGIN
      INSERT INTO public.prerender_queue (url_path, page_type, source_id, statut, force_rendu)
      VALUES ('/prestataire/' || NEW.slug, 'prestataire', NEW.id, 'a_traiter', true)
      ON CONFLICT (url_path) DO UPDATE
        SET statut='a_traiter', force_rendu=true, tentatives=0, source_id=EXCLUDED.source_id, updated_at=now();
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'prerender_fiche_publiee: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.prerender_fiche_publiee() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prerender_priorite_base(text, uuid) FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prerender_fiche_publiee ON public.prestataires;
CREATE TRIGGER trg_prerender_fiche_publiee AFTER INSERT OR UPDATE OF statut, slug ON public.prestataires
FOR EACH ROW EXECUTE FUNCTION public.prerender_fiche_publiee();

-- Recalcul des priorités de la file existante.
UPDATE public.prerender_queue SET priorite = 0 WHERE statut = 'a_traiter' AND priorite < 2000;
