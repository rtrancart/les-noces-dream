# P3 — Infrastructure Premium : vidéos, réseaux sociaux, statistiques avancées

Périmètre : base de données, stockage et collecte silencieuse. Aucune interface d'édition ou d'affichage, aucun bandeau de mise en avant, aucune restriction visible. La colonne vidéo historique et les anciennes valeurs de formule restent en place.

Les 7 sous-étapes sont traitées dans l'ordre, chacune close par son point de contrôle avant de passer à la suivante.

## Sous-étape 1 — Réseaux sociaux

- Quatre informations facultatives sur la fiche : TikTok, Instagram, Facebook, Pinterest.
- Contrôle en base appliqué seulement si la valeur est renseignée : l'adresse doit commencer par le domaine attendu (Pinterest accepte les trois variantes).
- Vue publique : les quatre informations sont ajoutées en fin de liste, sans réordonner l'existant.
- Signature de pré-rendu : les quatre valeurs entrent dans l'empreinte des fiches, donc toute modification déclenche une nouvelle capture à la tâche nocturne suivante.
- Contrôle : les quatre colonnes existent avec leur contrôle ; une adresse Instagram valide passe, une adresse mal formée est refusée ; la vue publique renvoie bien les quatre valeurs.

## Sous-étape 2 — Espace de stockage des vidéos

- Limite globale du projet relevée à 50 Mo par fichier (aucune limite n'est fixée aujourd'hui au niveau projet ; les espaces existants n'en ont pas non plus, sauf les instantanés à 10 Mo).
- Nouvel espace `prestataires-videos` : public, 30 Mo maximum par fichier.
- Restriction au format MP4 : elle sera posée directement sur l'espace ; si l'outil de création ne l'accepte pas, elle sera portée par la règle d'écriture (contrôle de l'extension du chemin) — écart signalé le cas échéant.
- Chemins attendus : dossier au nom de la fiche, vidéos à la racine du dossier, vignettes dans un sous-dossier.
- Règles d'accès : lecture ouverte ; ajout, modification et suppression réservés au propriétaire de la fiche et aux administrateurs, via une nouvelle fonction de contrôle calquée sur celle des photos.
- Contrôle : envoi accepté pour un MP4 de moins de 30 Mo ; refus au-delà de 30 Mo ; refus d'un format non autorisé ; refus depuis un compte qui n'est pas propriétaire.

## Sous-étape 3 — Table des vidéos

- Nouvelle table `prestataires_videos` : fiche concernée (suppression en cascade), adresse de la vidéo, adresse de la vignette, durée, poids, ordre d'affichage, dates de création et de modification.
- Accès : lecture publique ; ajout, modification et suppression réservés au propriétaire et aux administrateurs.
- Règle serveur à l'ajout : refus au-delà de 10 vidéos, refus si la fiche n'a pas d'abonnement Premium actif ; modification et suppression toujours autorisées, y compris après retour en Standard ; administrateurs non contraints.
- Mise à jour automatique de la date de modification.
- Index sur (fiche, ordre d'affichage).
- Vue publique : les vidéos sont exposées sous forme de liste ordonnée agrégée.
- Signature de pré-rendu : les adresses de vidéos triées entrent dans l'empreinte, donc ajout, suppression et réordonnancement déclenchent une nouvelle capture.
- **Réserve à trancher (point 3.5) : la suppression automatique du fichier physique à la suppression de la ligne n'est pas réalisable proprement depuis un déclencheur de base** — la base n'a pas de droit d'écriture sur le stockage et devrait appeler l'interface de stockage en réseau, avec une clé de service, sans possibilité d'annulation en cas d'échec. Deux options : (a) suppression du fichier faite par l'application au moment où l'utilisateur supprime la vidéo, plus une tâche nocturne de nettoyage des fichiers orphelins ; (b) déclencheur appelant le stockage en réseau malgré les limites. Recommandation : option (a).
- Contrôle : dixième ajout accepté et onzième refusé sur une fiche Premium ; premier ajout refusé sur une fiche Standard ; ajout administrateur accepté partout ; suppression d'une ligne suivie de la disparition du fichier ; vue publique correcte.

## Sous-étape 4 — Nettoyage des vidéos historiques

- Remise à vide de l'ancienne adresse vidéo sur les 17 fiches concernées.
- La colonne est conservée, sans écriture.
- Vérification qu'aucun fichier physique correspondant n'existe dans les espaces de stockage (les valeurs semblent être des liens externes, à confirmer).
- Contrôle : plus aucune fiche ne porte d'ancienne adresse vidéo.

## Sous-étape 5 — Table des sessions et rétention

- Nouvelle table `sessions_fiche` : identifiant de session, fiche consultée, début, fin, durée visible, indicateur de rebond, appareil, page d'origine.
- Accès : écriture anonyme autorisée comme pour les événements existants ; lecture réservée aux administrateurs et au propriétaire de la fiche ; modification et suppression réservées aux administrateurs.
- Unicité sur (session, fiche) pour neutraliser les doublons d'envoi.
- Index sur (fiche, date décroissante).
- Purge quotidienne des sessions de plus de 90 jours, planifiée à 04:00 UTC (le pré-rendu tourne à 03:00). Une seule tâche par jour, coût négligeable, retard maximal d'un jour sur la purge.
- Contrôle : insertion anonyme acceptée, doublon refusé, tâche planifiée visible.

## Sous-étape 6 — Extension de la mesure

- À l'ouverture d'une fiche : identifiant de session généré localement, sans stockage navigateur, remis à zéro à chaque chargement.
- Comptage du temps réellement visible (les périodes en arrière-plan ne comptent pas).
- Interactions retenues : défilement au-delà d'un quart de la page, clic sur la galerie, révélation du téléphone, ouverture du formulaire de demande.
- Envoi unique à la sortie (mise en arrière-plan, puis sortie de page en filet), par envoi en arrière-plan fiable, y compris sur iPhone.
- Nouvelle fonction serveur `insert-session-fiche` recevant l'envoi et enregistrant la ligne, la fin de session étant horodatée côté serveur.
- Collecte silencieuse : rien de visible pour les prestataires ni pour les administrateurs à ce stade.
- Contrôle : une fiche ouverte 30 secondes puis fermée produit une ligne ; une réouverture produit une seconde ligne distincte ; les envois apparaissent dans les journaux de la fonction.

## Sous-étape 7 — Vérifications globales

- La synchronisation Brevo ne se déclenche pas lors d'un ajout de vidéo (la fiche elle-même n'est pas modifiée).
- Parcours complet : passage en Premium, ajout de trois vidéos, retour en Standard, quatrième ajout refusé, suppression toujours possible.
- La signature de pré-rendu change bien après un ajout de vidéo et après une modification d'un lien social.
- **Réserve sur le point 7.3 (retour en Standard)** : avec les vidéos masquées à l'affichage seulement, un simple changement d'abonnement ne modifie aucune donnée entrant dans l'empreinte, donc aucune nouvelle capture n'est déclenchée. Pour obtenir la disparition immédiate que vous avez retenue, il faut faire entrer le statut Premium lui-même dans l'empreinte des fiches — c'est prévu dans ce plan et cela signifie qu'un changement d'abonnement provoquera une recapture de la fiche concernée.
- Aucune régression sur les 3 262 fiches existantes.

## Impacts attendus

L'ajout des nouvelles valeurs à l'empreinte modifie la signature de **toutes** les fiches actives d'un coup : la tâche nocturne suivante recapturera l'intégralité des fiches publiées. C'est le bon moment pour le faire (contenu vide), mais la nuit de bascule sera chargée.

## Détails techniques

- Migration 1 : colonnes `url_tiktok`, `url_instagram`, `url_facebook`, `url_pinterest` sur `prestataires` + contraintes `CHECK (col IS NULL OR col LIKE 'https://...%')` ; recréation de `prestataires_public` avec les colonnes ajoutées en fin de SELECT ; mise à jour de `prerender_pages_indexables()` (section `fiches`).
- Stockage : `supabase--configure_storage` à 50MB, puis `supabase--storage_create_bucket('prestataires-videos', public, '30MB')` ; politiques sur `storage.objects` et fonction `public.can_write_prestataire_video(p_path text)` calquée sur `can_write_prestataire_photo`.
- Migration 2 : `public.prestataires_videos` (FK `ON DELETE CASCADE`, index `(prestataire_id, ordre_affichage)`), GRANT (`anon` SELECT, `authenticated` CRUD, `service_role` ALL), RLS + politiques ; `check_limite_videos_selon_formule()` SECURITY DEFINER `search_path = public` en BEFORE INSERT uniquement ; `update_updated_at_column()` réutilisée en BEFORE UPDATE ; agrégat `json_agg` ordonné dans `prestataires_public` ; agrégat `string_agg` des URLs et `est_premium` intégrés à l'empreinte de `prerender_pages_indexables()`.
- Nettoyage legacy : `UPDATE prestataires SET video_url = NULL` via l'outil de données (pas une migration).
- Migration 3 : `public.sessions_fiche` (unicité `(session_id, prestataire_id)`, index `(prestataire_id, created_at DESC)`), GRANT (`anon`/`authenticated` INSERT, lecture propriétaire + `has_role`), `purge_sessions_fiche_expirees()` SECURITY DEFINER ; planification `cron.schedule` quotidienne à 04:00 UTC via l'outil de données (contient l'URL projet).
- Front : `src/lib/analytics.ts` étendu (session, temps visible cumulé via `visibilitychange`, `pagehide`, `navigator.sendBeacon`), branché depuis `FichePrestataireView`.
- Fonction serveur : `supabase/functions/insert-session-fiche/index.ts`, `verify_jwt = false`, validation stricte du corps, insertion tolérante au doublon.
- `src/lib/mcp/tools/get-prestataire.ts` : à compléter avec les nouvelles colonnes (hors périmètre strict, signalé dans le rapport si non fait).
