-- 1. CHAMPS COMMUNS
INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT NULL, 'formats_de_mariage', 'Formats de mariage', 'multi_choix',
  ARRAY['Mariage intime (moins de 30)', 'Grand mariage (plus de 200)', 'Elopement / mariage à deux', 'Mariage en semaine', 'Mariage d''hiver', 'Mariage sur plusieurs jours', 'Renouvellement de vœux'],
  'Profil & prestation', false, true, true, 90
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id IS NULL AND cle = 'formats_de_mariage');

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT NULL, 'demarche_eco_responsable', 'Démarche éco-responsable', 'booleen', NULL, 'Profil & prestation', false, true, true, 100
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id IS NULL AND cle = 'demarche_eco_responsable');

-- 2. LIEU DE RECEPTION
UPDATE public.champs_categories
SET options_liste = ARRAY['Château', 'Manoir / maison de maître', 'Domaine / mas / bastide', 'Domaine viticole', 'Grange / corps de ferme', 'Moulin', 'Abbaye / prieuré', 'Hôtel / palace', 'Restaurant', 'Péniche / bateau', 'Rooftop', 'Loft / lieu industriel', 'Salle de réception', 'Lieu insolite (cabane, chapiteau, musée…)'],
updated_at = now()
WHERE cle = 'type_de_lieu' AND categorie_id = 'ac98ce20-37f2-4210-8223-92e341067fa3'::uuid;

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT 'ac98ce20-37f2-4210-8223-92e341067fa3'::uuid, 'cadre', 'Cadre', 'multi_choix',
  ARRAY['Bord de mer / plage', 'Bord de lac / rivière', 'Montagne', 'Campagne', 'Vignes', 'Forêt', 'Ville', 'Vue panoramique'],
  'Lieu de réception', false, true, true, 230
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = 'ac98ce20-37f2-4210-8223-92e341067fa3'::uuid AND cle = 'cadre');

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT 'ac98ce20-37f2-4210-8223-92e341067fa3'::uuid, 'ambiance', 'Ambiance', 'multi_choix',
  ARRAY['Champêtre', 'Bohème', 'Romantique', 'Chic / classique', 'Minimaliste', 'Moderne / contemporain', 'Vintage / rétro', 'Baroque', 'Art déco', 'Industriel', 'Méditerranéen', 'Tropical / exotique', 'Nature / forêt', 'Bord de mer', 'Glamour', 'Sobre / corporate'],
  'Lieu de réception', false, true, true, 240
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = 'ac98ce20-37f2-4210-8223-92e341067fa3'::uuid AND cle = 'ambiance');

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT 'ac98ce20-37f2-4210-8223-92e341067fa3'::uuid, 'formules_de_location', 'Formules de location', 'multi_choix',
  ARRAY['Journée seule', 'Week-end complet', 'Brunch du lendemain possible', 'Location en semaine', 'Lieu à l''année (mariage d''hiver)'],
  'Lieu de réception', false, true, true, 250
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = 'ac98ce20-37f2-4210-8223-92e341067fa3'::uuid AND cle = 'formules_de_location');

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT 'ac98ce20-37f2-4210-8223-92e341067fa3'::uuid, 'equipements_detente', 'Équipements de détente', 'multi_choix',
  ARRAY['Piscine', 'Spa / jacuzzi', 'Jardin pour jeux d''extérieur', 'Salle de jeux enfants', 'Aucun'],
  'Lieu de réception', false, true, true, 260
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = 'ac98ce20-37f2-4210-8223-92e341067fa3'::uuid AND cle = 'equipements_detente');

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT 'ac98ce20-37f2-4210-8223-92e341067fa3'::uuid, 'accessible_pmr', 'Accessible PMR', 'booleen', NULL, 'Lieu de réception', false, true, true, 270
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = 'ac98ce20-37f2-4210-8223-92e341067fa3'::uuid AND cle = 'accessible_pmr');

-- 3. MUSIQUE
WITH elements AS (
  SELECT p.id,
    CASE elem.val
      WHEN 'Duo acoustique' THEN 'Duo / trio acoustique'
      WHEN 'DJ + live' THEN 'DJ + musicien live (sax, percussions…)'
      ELSE elem.val
    END AS val_finale
  FROM public.prestataires p,
  LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(p.champs_specifiques->'type_de_prestation') = 'array'
         THEN p.champs_specifiques->'type_de_prestation' ELSE '[]'::jsonb END
  ) AS elem(val)
  WHERE (p.categorie_mere_id = '37c46d6a-24ed-49d3-b10b-8c81eab6ef49'::uuid OR p.categorie_fille_id = '37c46d6a-24ed-49d3-b10b-8c81eab6ef49'::uuid)
),
reconstitue AS (
  SELECT id, jsonb_agg(DISTINCT to_jsonb(val_finale)) AS nvx FROM elements GROUP BY id
)
UPDATE public.prestataires p
SET champs_specifiques = p.champs_specifiques || jsonb_build_object('type_de_prestation', r.nvx)
FROM reconstitue r WHERE p.id = r.id;

WITH elements_styles AS (
  SELECT p.id,
    CASE elem.val
      WHEN 'Électro' THEN 'Électro / techno'
      ELSE elem.val
    END AS val_finale
  FROM public.prestataires p,
  LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(p.champs_specifiques->'styles_musicaux') = 'array'
         THEN p.champs_specifiques->'styles_musicaux' ELSE '[]'::jsonb END
  ) AS elem(val)
  WHERE (p.categorie_mere_id = '37c46d6a-24ed-49d3-b10b-8c81eab6ef49'::uuid OR p.categorie_fille_id = '37c46d6a-24ed-49d3-b10b-8c81eab6ef49'::uuid)
),
reconstitue_styles AS (
  SELECT id, jsonb_agg(DISTINCT to_jsonb(val_finale)) AS nvx FROM elements_styles GROUP BY id
)
UPDATE public.prestataires p
SET champs_specifiques = p.champs_specifiques || jsonb_build_object('styles_musicaux', r.nvx)
FROM reconstitue_styles r WHERE p.id = r.id;

UPDATE public.champs_categories
SET options_liste = ARRAY['DJ', 'DJ + musicien live (sax, percussions…)', 'Groupe live', 'Duo / trio acoustique', 'Chanteur / chanteuse solo', 'Quatuor à cordes', 'Groupe de jazz', 'Harpiste', 'Pianiste', 'Gospel / chorale', 'Fanfare / brass band', 'Musiciens traditionnels (bagad, oriental, mariachi…)'],
updated_at = now()
WHERE cle = 'type_de_prestation' AND categorie_id = '37c46d6a-24ed-49d3-b10b-8c81eab6ef49'::uuid;

UPDATE public.champs_categories
SET options_liste = ARRAY['Variété française', 'Variété / pop', 'Rock', 'Années 60-70', 'Années 80-90', 'Années 2000', 'Disco / funk', 'Soul / Motown', 'Hip-hop / R&B', 'House', 'Électro / techno', 'Latino', 'Afro / caribéen (zouk, kompa, afrobeats)', 'Oriental', 'Indien / Bollywood', 'Musiques du monde', 'Jazz / swing', 'Rétro', 'Gospel', 'Classique', 'Musiques de films', 'Généraliste'],
updated_at = now()
WHERE cle = 'styles_musicaux' AND categorie_id = '37c46d6a-24ed-49d3-b10b-8c81eab6ef49'::uuid;

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT '37c46d6a-24ed-49d3-b10b-8c81eab6ef49'::uuid, 'ambiance_de_soiree', 'Ambiance de soirée', 'multi_choix',
  ARRAY['Dansante / festive', 'Club', 'Lounge / chic', 'Intergénérationnelle', 'Thématique (années 80, guinguette…)'],
  'Musique', false, true, true, 120
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = '37c46d6a-24ed-49d3-b10b-8c81eab6ef49'::uuid AND cle = 'ambiance_de_soiree');

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT '37c46d6a-24ed-49d3-b10b-8c81eab6ef49'::uuid, 'repertoire_ceremonie', 'Répertoire cérémonie', 'multi_choix',
  ARRAY['Classique', 'Pop réarrangée', 'Chants religieux / messe', 'Gospel', 'Musiques de films', 'Sur demande'],
  'Musique', false, true, true, 130
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = '37c46d6a-24ed-49d3-b10b-8c81eab6ef49'::uuid AND cle = 'repertoire_ceremonie');

-- 4. PHOTO / VIDEO : fusion approche -> style sans doublon
WITH mapping(old_val, new_val) AS (
  VALUES
    ('Reportage', 'Reportage / photojournalisme'),
    ('Fine art', 'Fine art'),
    ('Éditorial', 'Éditorial / créatif'),
    ('Posé', 'Posé / traditionnel')
),
elements_approche AS (
  SELECT p.id, COALESCE(m.new_val, elem.val) AS val_style
  FROM public.prestataires p,
  LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(p.champs_specifiques->'approche') = 'array'
         THEN p.champs_specifiques->'approche' ELSE '[]'::jsonb END
  ) AS elem(val)
  LEFT JOIN mapping m ON m.old_val = elem.val
  WHERE p.champs_specifiques ? 'approche'
    AND (p.categorie_mere_id = '8f9d577e-6654-4d78-bf9e-da79701ab03c'::uuid
         OR p.categorie_fille_id IN ('4597d2ff-a546-48ba-845f-cf74c1052a97'::uuid, 'e03efe3b-0661-42ba-b1dd-f7dbab9b27c9'::uuid))
),
elements_style_existant AS (
  SELECT p.id, elem.val AS val_style
  FROM public.prestataires p,
  LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(p.champs_specifiques->'style') = 'array'
         THEN p.champs_specifiques->'style' ELSE '[]'::jsonb END
  ) AS elem(val)
  WHERE p.champs_specifiques ? 'approche'
    AND (p.categorie_mere_id = '8f9d577e-6654-4d78-bf9e-da79701ab03c'::uuid
         OR p.categorie_fille_id IN ('4597d2ff-a546-48ba-845f-cf74c1052a97'::uuid, 'e03efe3b-0661-42ba-b1dd-f7dbab9b27c9'::uuid))
),
tous_styles AS (
  SELECT id, val_style FROM elements_approche
  UNION
  SELECT id, val_style FROM elements_style_existant
),
fusionne AS (
  SELECT id, jsonb_agg(DISTINCT to_jsonb(val_style)) AS nvx_styles FROM tous_styles GROUP BY id
)
UPDATE public.prestataires p
SET champs_specifiques = (p.champs_specifiques - 'approche') || jsonb_build_object('style', f.nvx_styles)
FROM fusionne f
WHERE p.id = f.id;

DELETE FROM public.champs_categories
WHERE cle = 'approche' AND categorie_id = '8f9d577e-6654-4d78-bf9e-da79701ab03c'::uuid;

UPDATE public.champs_categories
SET options_liste = ARRAY['Reportage / photojournalisme', 'Posé / traditionnel', 'Portrait studio', 'Éditorial / créatif', 'Fine art', 'Documentaire / storytelling'],
updated_at = now()
WHERE cle = 'style' AND categorie_id IN ('4597d2ff-a546-48ba-845f-cf74c1052a97'::uuid, 'e03efe3b-0661-42ba-b1dd-f7dbab9b27c9'::uuid);

DO $$
DECLARE
  cat_id uuid;
BEGIN
  FOREACH cat_id IN ARRAY ARRAY['4597d2ff-a546-48ba-845f-cf74c1052a97'::uuid, 'e03efe3b-0661-42ba-b1dd-f7dbab9b27c9'::uuid] LOOP
    INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
    SELECT cat_id, 'rendu_des_images', 'Rendu des images', 'multi_choix',
      ARRAY['Lumineux / pastel', 'Naturel / fidèle', 'Chaud / doré', 'Contrasté / moody', 'Noir et blanc', 'Grain argentique'],
      'Photo / Vidéo', false, true, true, 130
    WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = cat_id AND cle = 'rendu_des_images');

    INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
    SELECT cat_id, 'supports', 'Supports', 'multi_choix',
      ARRAY['Numérique', 'Argentique', 'Polaroïd / instantané', 'Super 8 / pellicule (vidéo)'],
      'Photo / Vidéo', false, true, true, 140
    WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = cat_id AND cle = 'supports');

    INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
    SELECT cat_id, 'style_de_film', 'Style de film', 'multi_choix',
      ARRAY['Cinématographique', 'Documentaire', 'Clip dynamique', 'Vintage', 'Avec témoignages / discours'],
      'Photo / Vidéo', false, true, true, 150
    WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = cat_id AND cle = 'style_de_film');

    INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
    SELECT cat_id, 'nombre_photographes', 'Nombre de photographes / vidéastes', 'liste',
      ARRAY['1', '2', '3 et plus'],
      'Photo / Vidéo', false, true, true, 160
    WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = cat_id AND cle = 'nombre_photographes');

    INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
    SELECT cat_id, 'options_photo', 'Options', 'multi_choix',
      ARRAY['Photobooth', 'Photos de groupe organisées', 'Livraison d''un aperçu sous 48 h', 'Montage diffusé le soir même', 'Livestream de la cérémonie'],
      'Photo / Vidéo', false, true, true, 170
    WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = cat_id AND cle = 'options_photo');
  END LOOP;
END $$;

-- 5. FLEURISTE
WITH elements AS (
  SELECT p.id,
    CASE
      WHEN elem.val = 'Bouquet de la mariée' THEN 'Bouquet de mariée'
      WHEN elem.val LIKE 'Cérémonie laïque / lieu de culte%' THEN 'Allée de cérémonie'
      ELSE elem.val
    END AS val_finale,
    elem.val AS val_origine
  FROM public.prestataires p,
  LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(p.champs_specifiques->'realisations_florales_proposees') = 'array'
         THEN p.champs_specifiques->'realisations_florales_proposees' ELSE '[]'::jsonb END
  ) AS elem(val)
  WHERE p.categorie_mere_id = '54e6e11e-1747-458a-851c-411337c84f65'::uuid
     OR p.categorie_fille_id = '54e6e11e-1747-458a-851c-411337c84f65'::uuid
),
ajouts AS (
  SELECT id, val_finale AS val FROM elements
  UNION
  SELECT id, 'Décoration d''église / mairie' AS val FROM elements
  WHERE val_origine LIKE 'Cérémonie laïque / lieu de culte%'
  UNION
  SELECT id, 'Décoration de voiture' AS val FROM elements
  WHERE val_origine LIKE 'Cérémonie laïque / lieu de culte%'
),
reconstitue AS (
  SELECT id, jsonb_agg(DISTINCT to_jsonb(val)) AS nvx FROM ajouts GROUP BY id
)
UPDATE public.prestataires p
SET champs_specifiques = p.champs_specifiques || jsonb_build_object('realisations_florales_proposees', r.nvx)
FROM reconstitue r WHERE p.id = r.id;

UPDATE public.champs_categories
SET options_liste = ARRAY['Bouquet de mariée', 'Bouquet à lancer', 'Boutonnières', 'Couronne de fleurs', 'Bracelets fleuris', 'Arche florale', 'Allée de cérémonie', 'Décoration d''église / mairie', 'Centres de table', 'Suspensions florales', 'Décoration de salle', 'Décoration de voiture', 'Décoration du gâteau'],
updated_at = now()
WHERE cle = 'realisations_florales_proposees' AND categorie_id = '54e6e11e-1747-458a-851c-411337c84f65'::uuid;

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT '54e6e11e-1747-458a-851c-411337c84f65'::uuid, 'style_floral', 'Style floral', 'multi_choix',
  ARRAY['Champêtre / bucolique', 'Bohème', 'Romantique', 'Chic / classique', 'Minimaliste / épuré', 'Luxuriant / généreux', 'Sauvage / naturel', 'Japonisant / ikebana', 'Tropical / exotique', 'Méditerranéen', 'Monochrome blanc et vert', 'Fleurs séchées / stabilisées'],
  'Fleuriste', false, true, true, 80
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = '54e6e11e-1747-458a-851c-411337c84f65'::uuid AND cle = 'style_floral');

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT '54e6e11e-1747-458a-851c-411337c84f65'::uuid, 'fleurs_predilection', 'Fleurs de prédilection', 'multi_choix',
  ARRAY['Roses', 'Pivoines', 'Renoncules', 'Hortensias', 'Dahlias', 'Fleurs des champs', 'Gypsophile', 'Orchidées', 'Lavande', 'Eucalyptus / feuillages', 'Pampas / graminées'],
  'Fleuriste', false, true, true, 90
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = '54e6e11e-1747-458a-851c-411337c84f65'::uuid AND cle = 'fleurs_predilection');

-- 6. DECORATION
UPDATE public.champs_categories
SET options_liste = ARRAY['Champêtre', 'Bohème', 'Romantique', 'Chic / classique', 'Minimaliste', 'Moderne / contemporain', 'Vintage / rétro', 'Baroque', 'Art déco', 'Industriel', 'Méditerranéen', 'Tropical / exotique', 'Nature / forêt', 'Bord de mer', 'Glamour', 'Sobre / corporate'],
updated_at = now()
WHERE cle = 'styles_maitrises' AND categorie_id = 'abbd8880-8c2b-461d-90c6-669f07137e74'::uuid;

UPDATE public.champs_categories
SET options_liste = ARRAY['Arche', 'Art de la table', 'Centres de table', 'Scénographie complète', 'Photobooth', 'Néon', 'Ballons', 'Mobilier / assises', 'Vaisselle et verres', 'Signalétique / panneaux', 'Mise en lumière (guirlandes, bougies)', 'Plafond décoré / voilages', 'Décor de cérémonie'],
updated_at = now()
WHERE cle = 'elements_proposes' AND categorie_id = 'abbd8880-8c2b-461d-90c6-669f07137e74'::uuid;

-- 7. LOCATION MATERIEL
UPDATE public.champs_categories
SET options_liste = ARRAY['Tables', 'Assises / fauteuils', 'Vaisselle', 'Nappage / linge', 'Arches', 'Luminaires', 'Tentes / tipis', 'Structures bois', 'Décoration (photobooth, caravane, mobilier lounge…)'],
updated_at = now()
WHERE cle = 'elements_proposes_a_la_location' AND categorie_id = '3c258cdd-f16a-4611-b069-e26299fea073'::uuid;

WITH elements AS (
  SELECT p.id,
    CASE
      WHEN elem.val LIKE 'Décoration (photobooth%' THEN 'Décoration (photobooth, caravane, mobilier lounge…)'
      ELSE elem.val
    END AS val_finale
  FROM public.prestataires p,
  LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(p.champs_specifiques->'elements_proposes_a_la_location') = 'array'
         THEN p.champs_specifiques->'elements_proposes_a_la_location' ELSE '[]'::jsonb END
  ) AS elem(val)
  WHERE (p.categorie_mere_id = '3c258cdd-f16a-4611-b069-e26299fea073'::uuid OR p.categorie_fille_id = '3c258cdd-f16a-4611-b069-e26299fea073'::uuid)
),
reconstitue AS (
  SELECT id, jsonb_agg(DISTINCT to_jsonb(val_finale)) AS nvx FROM elements GROUP BY id
)
UPDATE public.prestataires p
SET champs_specifiques = p.champs_specifiques || jsonb_build_object('elements_proposes_a_la_location', r.nvx)
FROM reconstitue r WHERE p.id = r.id;

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT '3c258cdd-f16a-4611-b069-e26299fea073'::uuid, 'styles_proposes', 'Styles proposés', 'multi_choix',
  ARRAY['Champêtre', 'Bohème', 'Romantique', 'Chic / classique', 'Minimaliste', 'Moderne / contemporain', 'Vintage / rétro', 'Baroque', 'Art déco', 'Industriel', 'Méditerranéen', 'Tropical / exotique', 'Nature / forêt', 'Bord de mer', 'Glamour', 'Sobre / corporate'],
  'Location matériel', false, true, true, 110
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = '3c258cdd-f16a-4611-b069-e26299fea073'::uuid AND cle = 'styles_proposes');

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT '3c258cdd-f16a-4611-b069-e26299fea073'::uuid, 'pieces_phares', 'Pièces phares', 'multi_choix',
  ARRAY['Chaises Napoléon / chiavari', 'Chaises bistrot', 'Fauteuils en rotin', 'Tables rondes', 'Grandes tables en bois', 'Mange-debout', 'Salon lounge', 'Vaisselle dépareillée / vintage', 'Vaisselle dorée', 'Verrerie colorée', 'Tapis / coussins bohèmes'],
  'Location matériel', false, true, true, 120
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = '3c258cdd-f16a-4611-b069-e26299fea073'::uuid AND cle = 'pieces_phares');

-- 8. PAPETERIE
WITH elements AS (
  SELECT p.id,
    CASE elem.val
      WHEN 'Cartons' THEN 'Invitations civiles / religieuses'
      ELSE elem.val
    END AS val_finale
  FROM public.prestataires p,
  LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(p.champs_specifiques->'prestations_proposees') = 'array'
         THEN p.champs_specifiques->'prestations_proposees' ELSE '[]'::jsonb END
  ) AS elem(val)
  WHERE (p.categorie_mere_id = '39b4dad0-427d-4796-91ce-62ae23633603'::uuid OR p.categorie_fille_id = '39b4dad0-427d-4796-91ce-62ae23633603'::uuid)
),
reconstitue AS (
  SELECT id, jsonb_agg(DISTINCT to_jsonb(val_finale)) AS nvx FROM elements GROUP BY id
)
UPDATE public.prestataires p
SET champs_specifiques = p.champs_specifiques || jsonb_build_object('prestations_proposees', r.nvx)
FROM reconstitue r WHERE p.id = r.id;

UPDATE public.champs_categories
SET options_liste = ARRAY['Faire-part', 'Save-the-date', 'Invitations civiles / religieuses', 'Livret de messe / cérémonie', 'Menus', 'Marque-places', 'Plan de table', 'Cartes de remerciement', 'Signalétique / panneaux', 'Étiquettes et stickers', 'Logo / monogramme', 'Site web de mariage'],
updated_at = now()
WHERE cle = 'prestations_proposees' AND categorie_id = '39b4dad0-427d-4796-91ce-62ae23633603'::uuid;

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT '39b4dad0-427d-4796-91ce-62ae23633603'::uuid, 'style_graphique', 'Style graphique', 'multi_choix',
  ARRAY['Classique / élégant', 'Minimaliste', 'Moderne / typographique', 'Bohème', 'Champêtre / botanique', 'Aquarelle', 'Illustré sur-mesure', 'Calligraphie', 'Romantique', 'Vintage', 'Art déco', 'Tropical', 'Ludique / humoristique'],
  'Papeterie', false, true, true, 90
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = '39b4dad0-427d-4796-91ce-62ae23633603'::uuid AND cle = 'style_graphique');

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT '39b4dad0-427d-4796-91ce-62ae23633603'::uuid, 'papiers_matieres', 'Papiers et matières', 'multi_choix',
  ARRAY['Papier recyclé', 'Papier ensemencé (à planter)', 'Papier coton / épais', 'Papier fait main', 'Calque', 'Kraft'],
  'Papeterie', false, true, true, 100
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = '39b4dad0-427d-4796-91ce-62ae23633603'::uuid AND cle = 'papiers_matieres');

-- 9. TRAITEUR
DO $$
DECLARE
  cat_id uuid;
BEGIN
  FOREACH cat_id IN ARRAY ARRAY['f929dcda-7726-4f40-a97c-dfd77860f27f'::uuid, '51cd104b-65b7-464b-9eaf-774f4a488164'::uuid] LOOP
    INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
    SELECT cat_id, 'style_de_cuisine', 'Style de cuisine', 'multi_choix',
      ARRAY['Française traditionnelle', 'Bistronomique', 'Gastronomique', 'Régionale / terroir', 'Méditerranéenne', 'Italienne', 'Orientale / maghrébine', 'Libanaise', 'Asiatique', 'Indienne', 'Africaine', 'Antillaise / créole', 'Fusion', 'Végétale', 'Grill / barbecue', 'Street food'],
      'Traiteur', false, true, true, 140
    WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = cat_id AND cle = 'style_de_cuisine');

    INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
    SELECT cat_id, 'regimes_specifiques', 'Régimes spécifiques', 'multi_choix',
      ARRAY['Halal', 'Casher', 'Végétarien', 'Vegan', 'Sans gluten', 'Sans lactose', 'Sans porc'],
      'Traiteur', false, true, true, 150
    WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = cat_id AND cle = 'regimes_specifiques');

    INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
    SELECT cat_id, 'animations_culinaires', 'Animations culinaires', 'multi_choix',
      ARRAY['Bar à huîtres', 'Découpe de jambon', 'Plancha en direct', 'Plateau de fromages', 'Foie gras poêlé minute', 'Risotto en meule', 'Sushi en direct', 'Méchoui / cochon de lait', 'Bar à desserts'],
      'Traiteur', false, true, true, 160
    WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = cat_id AND cle = 'animations_culinaires');

    INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
    SELECT cat_id, 'services_complementaires', 'Services complémentaires', 'multi_choix',
      ARRAY['Vin d''honneur', 'Brunch du lendemain', 'Repas des prestataires', 'Repas de la veille', 'Food truck de fin de soirée'],
      'Traiteur', false, true, true, 170
    WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = cat_id AND cle = 'services_complementaires');
  END LOOP;
END $$;

-- 10. PATISSERIE
INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT '05014dc3-5b07-445c-a77a-331d2c9d4504'::uuid, 'style_de_creation', 'Style de création', 'multi_choix',
  ARRAY['Classique / élégant', 'Naked / semi-naked', 'Champêtre', 'Floral', 'Moderne / géométrique', 'Minimaliste', 'Gourmand / drip cake', 'Luxe / feuille d''or', 'Pièce montée traditionnelle', 'Thématique / sur-mesure'],
  'Pâtisserie', false, true, true, 90
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = '05014dc3-5b07-445c-a77a-331d2c9d4504'::uuid AND cle = 'style_de_creation');

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT '05014dc3-5b07-445c-a77a-331d2c9d4504'::uuid, 'saveurs_phares', 'Saveurs phares', 'multi_choix',
  ARRAY['Vanille', 'Chocolat', 'Fruits rouges', 'Agrumes', 'Fruits exotiques', 'Praliné / noisette', 'Caramel', 'Pistache', 'Florales (rose, fleur d''oranger)'],
  'Pâtisserie', false, true, true, 100
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = '05014dc3-5b07-445c-a77a-331d2c9d4504'::uuid AND cle = 'saveurs_phares');

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT '05014dc3-5b07-445c-a77a-331d2c9d4504'::uuid, 'tenue_chaleur', 'Tenue à la chaleur / en extérieur', 'booleen', NULL, 'Pâtisserie', false, true, true, 110
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = '05014dc3-5b07-445c-a77a-331d2c9d4504'::uuid AND cle = 'tenue_chaleur');

-- 11. ROBE DE MARIEE
INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT 'cfc61edc-246c-4b74-a79d-75d3858358de'::uuid, 'silhouettes', 'Silhouettes', 'multi_choix',
  ARRAY['Princesse / ballerine', 'Évasée (trapèze)', 'Sirène', 'Trompette', 'Fourreau', 'Fluide / empire', 'Courte', 'Combinaison', 'Tailleur / pantalon'],
  'Robe', false, true, true, 100
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = 'cfc61edc-246c-4b74-a79d-75d3858358de'::uuid AND cle = 'silhouettes');

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT 'cfc61edc-246c-4b74-a79d-75d3858358de'::uuid, 'styles_robe', 'Styles', 'multi_choix',
  ARRAY['Bohème', 'Romantique', 'Classique / élégante', 'Minimaliste', 'Moderne', 'Vintage', 'Glamour', 'Rock', 'Champêtre'],
  'Robe', false, true, true, 110
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = 'cfc61edc-246c-4b74-a79d-75d3858358de'::uuid AND cle = 'styles_robe');

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT 'cfc61edc-246c-4b74-a79d-75d3858358de'::uuid, 'matieres_robe', 'Matières', 'multi_choix',
  ARRAY['Dentelle', 'Tulle', 'Crêpe', 'Satin / mikado', 'Mousseline', 'Soie', 'Paillettes / perles'],
  'Robe', false, true, true, 120
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = 'cfc61edc-246c-4b74-a79d-75d3858358de'::uuid AND cle = 'matieres_robe');

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT 'cfc61edc-246c-4b74-a79d-75d3858358de'::uuid, 'particularites_robe', 'Particularités', 'multi_choix',
  ARRAY['Robe deux-en-un / transformable', 'Robe de soirée assortie', 'Robes de couleur', 'Manches longues / robe pudique', 'Robe de grossesse', 'Robe éco-responsable / upcyclée'],
  'Robe', false, true, true, 130
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = 'cfc61edc-246c-4b74-a79d-75d3858358de'::uuid AND cle = 'particularites_robe');

-- 12. COSTUME
WITH elements AS (
  SELECT p.id,
    CASE elem.val
      WHEN 'Moderne' THEN 'Moderne / slim'
      ELSE elem.val
    END AS val_finale
  FROM public.prestataires p,
  LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(p.champs_specifiques->'styles_proposes') = 'array'
         THEN p.champs_specifiques->'styles_proposes' ELSE '[]'::jsonb END
  ) AS elem(val)
  WHERE (p.categorie_mere_id = 'e236d4b6-61d4-4d50-8949-1cd92145c587'::uuid OR p.categorie_fille_id = 'e236d4b6-61d4-4d50-8949-1cd92145c587'::uuid)
),
reconstitue AS (
  SELECT id, jsonb_agg(DISTINCT to_jsonb(val_finale)) AS nvx FROM elements GROUP BY id
)
UPDATE public.prestataires p
SET champs_specifiques = p.champs_specifiques || jsonb_build_object('styles_proposes', r.nvx)
FROM reconstitue r WHERE p.id = r.id;

WITH elements_acc AS (
  SELECT p.id,
    CASE elem.val
      WHEN 'Aucun (bouton de manchette)' THEN 'Boutons de manchette'
      ELSE elem.val
    END AS val_finale
  FROM public.prestataires p,
  LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(p.champs_specifiques->'accessoires_assortis_proposes') = 'array'
         THEN p.champs_specifiques->'accessoires_assortis_proposes' ELSE '[]'::jsonb END
  ) AS elem(val)
  WHERE (p.categorie_mere_id = 'e236d4b6-61d4-4d50-8949-1cd92145c587'::uuid OR p.categorie_fille_id = 'e236d4b6-61d4-4d50-8949-1cd92145c587'::uuid)
),
reconstitue_acc AS (
  SELECT id, jsonb_agg(DISTINCT to_jsonb(val_finale)) AS nvx FROM elements_acc GROUP BY id
)
UPDATE public.prestataires p
SET champs_specifiques = p.champs_specifiques || jsonb_build_object('accessoires_assortis_proposes', r.nvx)
FROM reconstitue_acc r WHERE p.id = r.id;

UPDATE public.champs_categories
SET options_liste = ARRAY['Classique', 'Moderne / slim', 'Vintage', 'Décontracté chic', 'Smoking / black tie', 'Jaquette', 'Trois-pièces', 'Champêtre (tweed, lin)', 'Tenue traditionnelle'],
updated_at = now()
WHERE cle = 'styles_proposes' AND categorie_id = 'e236d4b6-61d4-4d50-8949-1cd92145c587'::uuid;

UPDATE public.champs_categories
SET options_liste = ARRAY['Cravate', 'Nœud papillon', 'Pochette', 'Bretelles', 'Chaussures', 'Boutons de manchette', 'Aucun'],
updated_at = now()
WHERE cle = 'accessoires_assortis_proposes' AND categorie_id = 'e236d4b6-61d4-4d50-8949-1cd92145c587'::uuid;

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT 'e236d4b6-61d4-4d50-8949-1cd92145c587'::uuid, 'matieres_costume', 'Matières', 'multi_choix',
  ARRAY['Laine', 'Lin', 'Coton', 'Velours', 'Tweed'],
  'Costume', false, true, true, 90
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = 'e236d4b6-61d4-4d50-8949-1cd92145c587'::uuid AND cle = 'matieres_costume');

-- 13. BIJOUX ET ACCESSOIRES
UPDATE public.champs_categories
SET options_liste = ARRAY['Alliances', 'Bagues de fiançailles', 'Bijoux de mariée', 'Bijoux pour le cortège', 'Boutons de manchette'],
updated_at = now()
WHERE cle = 'types_de_bijoux_proposes' AND categorie_id = '7cd6fd99-02c8-4708-8f96-a9e2eedb6be3'::uuid;

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT '7cd6fd99-02c8-4708-8f96-a9e2eedb6be3'::uuid, 'style_bijoux', 'Style', 'multi_choix',
  ARRAY['Classique', 'Minimaliste', 'Vintage / ancien', 'Art déco', 'Bohème', 'Moderne / design', 'Romantique'],
  'Bijoux', false, true, true, 110
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = '7cd6fd99-02c8-4708-8f96-a9e2eedb6be3'::uuid AND cle = 'style_bijoux');

UPDATE public.champs_categories
SET options_liste = ARRAY['Voile', 'Couronne / headband', 'Ceinture', 'Gants', 'Broche', 'Peigne / épingles', 'Cape / boléro', 'Chapeau', 'Cravate / nœud papillon', 'Boutons de manchette'],
updated_at = now()
WHERE cle = 'types_d_accessoires_proposes' AND categorie_id = 'eb40928b-4351-4470-b42c-3dac8dd709d9'::uuid;

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT 'eb40928b-4351-4470-b42c-3dac8dd709d9'::uuid, 'style_accessoires', 'Style', 'multi_choix',
  ARRAY['Classique', 'Minimaliste', 'Vintage / ancien', 'Art déco', 'Bohème', 'Moderne / design', 'Romantique'],
  'Accessoires', false, true, true, 70
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = 'eb40928b-4351-4470-b42c-3dac8dd709d9'::uuid AND cle = 'style_accessoires');

-- 14. COIFFURE
INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT '0b84ef70-a0b7-4fd3-95bc-72be31362b75'::uuid, 'styles_coiffure', 'Styles maîtrisés', 'multi_choix',
  ARRAY['Chignon bas classique', 'Chignon flou / bohème', 'Chignon haut', 'Tresses / couronne', 'Semi-attaché', 'Cheveux lâchés / ondulés', 'Rétro / pin-up', 'Coupes courtes'],
  'Coiffure', false, true, true, 90
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = '0b84ef70-a0b7-4fd3-95bc-72be31362b75'::uuid AND cle = 'styles_coiffure');

-- 15. BEAUTE
WITH elements AS (
  SELECT p.id,
    CASE elem.val
      WHEN 'Maquillage masculin (coiffure' THEN 'Maquillage masculin'
      ELSE elem.val
    END AS val_finale
  FROM public.prestataires p,
  LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(p.champs_specifiques->'prestations_proposees') = 'array'
         THEN p.champs_specifiques->'prestations_proposees' ELSE '[]'::jsonb END
  ) AS elem(val)
  WHERE (p.categorie_mere_id = 'd121becd-db9f-43bf-a2e6-21e8585bd2d2'::uuid OR p.categorie_fille_id = 'd121becd-db9f-43bf-a2e6-21e8585bd2d2'::uuid)
),
reconstitue AS (
  SELECT id, jsonb_agg(DISTINCT to_jsonb(val_finale)) AS nvx FROM elements GROUP BY id
)
UPDATE public.prestataires p
SET champs_specifiques = p.champs_specifiques || jsonb_build_object('prestations_proposees', r.nvx)
FROM reconstitue r WHERE p.id = r.id;

UPDATE public.champs_categories
SET options_liste = ARRAY['Maquillage mariée', 'Maquillage invités', 'Maquillage masculin', 'Ongles / manucure', 'Pédicure', 'Soins du visage'],
updated_at = now()
WHERE cle = 'prestations_proposees' AND categorie_id = 'd121becd-db9f-43bf-a2e6-21e8585bd2d2'::uuid;

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT 'd121becd-db9f-43bf-a2e6-21e8585bd2d2'::uuid, 'style_maquillage', 'Style de maquillage', 'multi_choix',
  ARRAY['Naturel / nude', 'Lumineux / glowy', 'Glamour', 'Smoky / sophistiqué', 'Rétro', 'Bohème', 'Oriental', 'Indien', 'Airbrush'],
  'Beauté', false, true, true, 100
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = 'd121becd-db9f-43bf-a2e6-21e8585bd2d2'::uuid AND cle = 'style_maquillage');

-- 16. CEREMONIE
UPDATE public.champs_categories
SET options_liste = ARRAY['Laïque', 'Humaniste', 'Interculturelle / bilingue', 'Interreligieuse', 'Renouvellement de vœux', 'Cérémonie pour enfants / famille recomposée'],
updated_at = now()
WHERE cle = 'types_de_ceremonies' AND categorie_id = 'e9ef9cab-8a6e-4f51-8cb1-02e08d26e94a'::uuid;

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT 'e9ef9cab-8a6e-4f51-8cb1-02e08d26e94a'::uuid, 'dimension_spirituelle', 'Dimension spirituelle', 'multi_choix',
  ARRAY['Sans référence spirituelle', 'Spirituelle', 'Inspirée de traditions religieuses'],
  'Cérémonie', false, true, true, 90
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = 'e9ef9cab-8a6e-4f51-8cb1-02e08d26e94a'::uuid AND cle = 'dimension_spirituelle');

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT 'e9ef9cab-8a6e-4f51-8cb1-02e08d26e94a'::uuid, 'implication_proches', 'Implication des proches', 'multi_choix',
  ARRAY['Lectures et témoignages', 'Rituel avec les invités', 'Participation des enfants', 'Musique en direct'],
  'Cérémonie', false, true, true, 100
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = 'e9ef9cab-8a6e-4f51-8cb1-02e08d26e94a'::uuid AND cle = 'implication_proches');

-- 17. TRANSPORT
INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT '30e318fc-5644-4945-8004-fa3abbbe68cd'::uuid, 'style_vehicule', 'Style de véhicule', 'multi_choix',
  ARRAY['Années 20-30', 'Années 50-60 / américaine', 'Combi / Coccinelle VW', '2CV', 'Rolls-Royce / Bentley', 'Cabriolet', 'Berline moderne de luxe', 'Moto / side-car', 'Calèche', 'Bateau'],
  'Transport', false, true, true, 100
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = '30e318fc-5644-4945-8004-fa3abbbe68cd'::uuid AND cle = 'style_vehicule');

INSERT INTO public.champs_categories (categorie_id, cle, label, type_champ, options_liste, groupe, obligatoire, visible_public, filtrable, ordre_affichage)
SELECT '30e318fc-5644-4945-8004-fa3abbbe68cd'::uuid, 'couleur_vehicule', 'Couleur du véhicule', 'multi_choix',
  ARRAY['Blanc / crème', 'Noir', 'Couleur pastel', 'Autre couleur'],
  'Transport', false, true, true, 110
WHERE NOT EXISTS (SELECT 1 FROM public.champs_categories WHERE categorie_id = '30e318fc-5644-4945-8004-fa3abbbe68cd'::uuid AND cle = 'couleur_vehicule');

-- 18. HEBERGEMENTS : rattachement des 13 champs depuis Caviste
UPDATE public.champs_categories
SET categorie_id = 'a0edbd75-cd37-44e9-9408-f7bc54296e7b'::uuid,
    groupe = 'Hébergement',
    updated_at = now()
WHERE categorie_id = 'a36524db-1815-4eec-bf0c-8af016f1bd7c'::uuid
  AND cle IN (
    'type_d_hebergement', 'nombre_de_couchages', 'privatisation_complete_possible',
    'chambre_dediee_aux_maries_suite', 'chambres_accessibles_pmr', 'petit_dejeuner_inclus',
    'restauration_sur_place', 'salle_de_reception_sur_place', 'piscine_spa',
    'parking', 'acces_navettes_minibus', 'arrivee_tardive_possible',
    'tarif_preferentiel_groupe_blocage_de_chambres'
  );