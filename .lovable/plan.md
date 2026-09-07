# P3 — Infrastructure Premium : vidéos, réseaux sociaux, statistiques avancées

Périmètre : base de données, stockage et collecte de mesures uniquement. Aucune interface de saisie, aucun affichage public, aucune règle de restriction visible à ce stade.

## Étape 1 — Liens réseaux sociaux

- Quatre nouvelles informations sur la fiche prestataire : TikTok, Instagram, Facebook, Pinterest (adresses web, facultatives).
- Contrôle simple en base : si renseignée, l'adresse doit commencer par https et pointer vers le domaine attendu.
- Ajout à la vue publique et à la signature de pré-rendu.
- Vérification : écriture et lecture d'une adresse de test, refus d'une adresse d'un mauvais domaine.

## Étape 2 — Espace de stockage des vidéos

- Nouvel espace `prestataires-videos`, public, plafonné à 30 Mo par fichier, limité aux formats MP4.
- Relèvement de la limite globale de stockage du projet à 50 Mo.
- Droits d'écriture calqués sur les photos : le propriétaire de la fiche ou un administrateur, dans un dossier au nom de la fiche ; lecture ouverte.
- Vérification : envoi d'un fichier de test accepté, refus d'un fichier trop lourd et d'un format non autorisé.

## Étape 3 — Table des vidéos

- Nouvelle table `prestataires_videos` : fiche concernée, adresse du fichier, adresse de la vignette, ordre d'affichage, durée, poids, date de création.
- Règles d'accès : lecture publique pour les fiches actives, écriture réservée au propriétaire et aux administrateurs.
- Règle serveur : maximum 10 vidéos par fiche ; l'ajout est refusé si la fiche n'est pas en formule Premium, mais la suppression et le réordonnancement restent toujours autorisés, y compris après retour en Standard. Les administrateurs ne sont pas contraints.
- Ajout à la vue publique (liste ordonnée) et à la signature de pré-rendu.
- Vérification : ajout refusé sur une fiche Standard, accepté sur une fiche Premium de test, refus au onzième ajout, suppression possible après retour en Standard.

## Étape 4 — Reprise de l'existant

- Les 17 anciennes adresses vidéo de la fiche sont reprises comme première vidéo de chaque fiche concernée.
- L'ancienne information reste en base, sans écriture, en attente de suppression dans un lot ultérieur.
- Vérification : 17 lignes créées, aucune perte.

## Étape 5 — Table des sessions de consultation

- Nouvelle table `sessions_fiche` : identifiant de session, fiche consultée, début, fin, durée visible en secondes, indicateur de rebond, type d'appareil, page d'origine.
- Écriture unique en fin de session ; lecture réservée aux administrateurs dans un premier temps.
- Purge automatique au-delà de 13 mois, sur le modèle de la purge de l'historique de navigation.
- Vérification : insertion anonyme possible, lecture impossible sans compte administrateur.

## Étape 6 — Extension de la collecte

- Le module de mesure existant ouvre une session à l'ouverture d'une fiche, compte le temps réellement visible, note les interactions significatives (défilement, clic, galerie, révélation du téléphone) et envoie une seule fois le résultat à la fermeture.
- Envoi déclenché par la mise en arrière-plan de l'onglet, avec filet à la sortie de page, par envoi en arrière-plan fiable (y compris sur iPhone).
- Rebond = aucune interaction significative pendant la visite.
- Aucun écran de restitution à ce stade : collecte silencieuse, exploitable côté administration, ouverture aux Premium dans un lot ultérieur après calibration.
- Vérification : parcours automatisé d'une fiche publique, contrôle qu'une ligne de session cohérente est bien enregistrée.

## Arbitrages retenus

- Vidéos dans une table dédiée plutôt que dans une liste sur la fiche : évite de réveiller les onze déclencheurs de la fiche et la synchronisation Brevo à chaque envoi.
- Réseaux sociaux en colonnes séparées plutôt qu'en bloc unique : structure fixe, validation et typage directs.
- Vignette de vidéo capturée par le navigateur au moment de l'envoi ; pas de traitement vidéo côté serveur.
- Contenu Premium intégré à la signature de pré-rendu : après un retour en Standard, les pages captées sont régénérées et le contenu disparaît immédiatement des versions vues par les moteurs de recherche.
- Statistiques d'abord internes, ouverture aux Premium après calibration.

## Détails techniques

- Migration : colonnes `url_tiktok`, `url_instagram`, `url_facebook`, `url_pinterest` sur `prestataires` avec contraintes de vérification par préfixe de domaine ; table `public.prestataires_videos` (clé étrangère en cascade, index `(prestataire_id, ordre_affichage)`), GRANT explicites (`anon` en lecture, `authenticated` en écriture, `service_role` complet), RLS puis politiques ; table `public.sessions_fiche` (insertion `anon`/`authenticated`, lecture administrateur via `has_role`).
- Déclencheur `check_video_quota()` en SECURITY DEFINER `search_path = public`, uniquement BEFORE INSERT sur `prestataires_videos`, lisant `prestataires.est_premium` et exemptant `has_role(auth.uid(),'admin'|'super_admin')`.
- `prerender_pages_indexables()` : ajout des quatre adresses sociales et d'un quatrième agrégat vidéo (`string_agg` ordonné) au condensé de la section `fiches` ; recréation de la vue `prestataires_public` avec les nouvelles colonnes et une agrégation des vidéos.
- Stockage : `supabase--storage_create_bucket` (`prestataires-videos`, public, 30MB) puis `supabase--configure_storage` à 50MB ; politiques sur `storage.objects` reprises de `can_write_prestataire_photo`.
- Front : extension de `src/lib/analytics.ts` (session, `visibilitychange`/`pagehide`, `navigator.sendBeacon`, temps visible cumulé) ; `src/lib/mcp/tools/get-prestataire.ts` à compléter avec les nouvelles colonnes.
- Purge : fonction `purger_sessions_fiche()` sur le modèle de `purger_historique_navigation()`, planifiée avec les tâches nocturnes existantes.
