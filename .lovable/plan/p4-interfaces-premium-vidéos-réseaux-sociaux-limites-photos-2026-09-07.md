# P4 — Interfaces Premium : vidéos, réseaux sociaux, limites photos

Objectif : rendre utilisables les fonctionnalités Premium mises en place en P3, côté espace prestataire et côté fiche publique. Aucune statistique avancée dans ce lot.

Arbitrages retenus : galerie photos de l'espace pro conservée telle quelle (ajout minimal), limite de 10 photos appliquée à la fois en base et dans l'interface, badge Premium harmonisé en or partout.

## 1. Connaître la formule dans l'espace pro

Aujourd'hui l'espace pro ne sait pas si le prestataire est Standard ou Premium : seule la fiche porte l'indicateur Premium, l'abonnement n'est lu que sur la page Abonnement.

- Le contexte partagé de l'espace pro charge en plus l'abonnement du prestataire (formule, périodicité, statut, changement programmé).
- Une valeur simple « est Premium » en est dérivée et sert de référence unique à tous les écrans de ce lot.

## 2. Réseaux sociaux dans « Mon profil »

- Nouveau bloc « Réseaux sociaux » placé après « Coordonnées », quatre champs (TikTok, Instagram, Facebook, Pinterest) sur deux colonnes en grand écran, chacun précédé de son icône.
- Petit champ réutilisable avec normalisation **au moment où l'utilisateur quitte le champ** : un identifiant saisi seul (`@moncompte`) est transformé en adresse complète, une adresse collée est nettoyée. Message d'erreur uniquement si la valeur reste inexploitable.
- La normalisation doit produire exactement le format accepté par les contrôles déjà posés en base, sinon l'enregistrement échouerait sans explication.
- Si le prestataire est Standard : les champs restent saisissables et enregistrables, mais un bandeau informatif au-dessus du bloc précise que ces liens ne s'affichent publiquement qu'en Premium.

## 3. Vidéos dans « Ma galerie »

Nouvelle section « Vidéos » sous la section photos existante.

- Envoi de fichiers MP4 un par un vers l'espace de stockage dédié, avec une vraie barre de progression en pourcentage (indispensable : jusqu'à 30 Mo par fichier).
- Vignette générée dans le navigateur au moment de l'envoi (image capturée vers la première seconde). Si le navigateur ne sait pas décoder le fichier, l'envoi se poursuit sans vignette — jamais de blocage.
- Durée et poids mesurés au même moment et enregistrés avec la vidéo ; durée laissée vide si illisible.
- Réordonnancement par glisser-déposer (même mécanique que la galerie photos de l'espace admin), suppression avec effacement du fichier stocké.
- Maximum 10 vidéos, déjà garanti en base.
- Si le prestataire est Standard : la section est visible mais l'ajout est désactivé, avec un bandeau expliquant l'offre. Les vidéos déjà présentes restent consultables, réordonnables et supprimables.

## 4. Limite de 10 photos pour les Standard

- Contrôle ajouté en base : refus d'ajout d'une onzième photo pour un prestataire non Premium (même logique que la règle vidéos existante, avec dérogation administrateur).
- Dans l'espace pro : compteur « x / 10 », bouton d'ajout désactivé une fois la limite atteinte, message expliquant le passage en Premium.
- Si un prestataire rétrogradé possède plus de 10 photos : rien n'est supprimé, un bandeau permanent indique combien de photos ne sont plus visibles publiquement.

## 5. Bandeaux Premium

- Un composant de bandeau unique, deux tons (informatif / alerte), aligné sur les bandeaux existants de l'espace pro — pas de voile grisé sur les sections.
- Affiché en permanence tant que la situation dure, non masquable, mais discret.
- Le bouton « Passer en Premium » renvoie vers la page Abonnement existante.

## 6. Fiche publique

Les données nécessaires arrivent déjà dans la page (vue publique en sélection totale) : aucune requête supplémentaire.

- **Vidéos** : nouvelle section juste après la galerie photos, affichée uniquement si Premium et au moins une vidéo. Bande de vignettes, lecture en plein écran au clic dans la visionneuse existante. Aucun lecteur chargé avant le clic, dimensions fixes, chargement différé.
- **Retrouvez-nous** : ligne d'icônes sociales en fin de contenu principal, avant la carte. Affichée seulement si Premium et au moins un lien ; icônes manquantes simplement absentes. Traitement monochrome, pas de couleurs de marque.
- **Photos** : au plus 10 photos affichées pour un prestataire Standard, illimité en Premium.
- **Badge Premium** : déjà présent dans l'en-tête, repris en or.

## 7. Harmonisation des badges

- Badge Premium en or (couleur de marque) sur la fiche, sur les cartes de résultats et dans la légende de la carte.
- Badge « Vérifié » laissé en neutre, pour que la hiérarchie visuelle soit lisible : or = offre payante, neutre = validation éditoriale.

## Détails techniques

- Contexte : `PrestataireContext` / `usePrestataire` étendus d'une lecture de `abonnements` (formule, periodicite, statut) ; valeur dérivée `estPremium` exposée.
- Nouveaux composants : `PremiumBanner`, `SocialLinkInput`, `PrestataireVideosSection`.
- Vidéos : bucket `prestataires-videos`, table `prestataires_videos` (`ordre_affichage`, `duree_seconds`, `taille_bytes`), envoi avec suivi de progression, vignette via canevas natif (aucune dépendance à installer), `@dnd-kit` déjà présent.
- Base : déclencheur de limite photos calqué sur `check_limite_videos_selon_formule()`, portant sur `urls_galerie` + `photo_principale_url`.
- Fiche : `FichePrestataireView` (sections vidéos et réseaux sociaux), `FicheGalerie` (plafond de 10 pour les non-Premium), `ProviderCard` et `SearchMap` (badge or).
- Attention : la sélection de la vue publique alimente l'empreinte de pré-rendu ; un changement d'abonnement provoquera une recapture des fiches concernées, comportement voulu.

## Ordre de déploiement

1. Formule exposée dans l'espace pro
2. Réseaux sociaux (espace pro puis fiche)
3. Limite photos (base, espace pro, fiche)
4. Vidéos (espace pro puis fiche)
5. Harmonisation des badges

## Hors périmètre

Statistiques avancées, nouvelle grille tarifaire, modification des fonctions Stripe.
