# Galerie photos admin : réordonnancement et dépôt en masse

## 1. Réordonner par glisser-déposer

Dans l'onglet Photos de la fiche prestataire (admin), les vignettes deviennent déplaçables :

- On saisit une photo et on la dépose à la position voulue ; la grille se réorganise en direct.
- La photo placée en première position devient automatiquement la photo principale (badge « Principale »).
- Inversement, un clic sur « Principale » déplace la photo en première position de la grille.
- L'ordre est enregistré immédiatement en base après chaque déplacement, avec retour visuel (toast) et remise à l'état précédent en cas d'échec.
- Le même ordre est repris tel quel sur la fiche publique (photo principale en tête, puis la galerie).

## 2. Ajout de photos par glisser-déposer

- Toute la zone de la galerie devient une zone de dépôt : on peut déposer un ou plusieurs fichiers depuis le Finder / l'Explorateur.
- Surlignage visuel de la zone pendant le survol du dépôt.
- Le bouton « Ajouter des photos » reste disponible.
- Mêmes contrôles qu'aujourd'hui : images uniquement, 5 Mo max par fichier, message d'erreur par fichier refusé.
- Les nouvelles photos s'ajoutent à la fin de la galerie ; si aucune photo principale n'existe, la première déposée le devient.
- Indicateur de progression pendant l'envoi (n sur total).

## Détails techniques

- Fichier : `src/components/admin/PrestatairePhotosTab.tsx`.
- Réordonnancement avec `@dnd-kit/core` + `@dnd-kit/sortable` (déjà installés) : `DndContext`, `SortableContext` en `rectSortingStrategy`, capteurs pointeur (contrainte de distance pour ne pas gêner les clics) et clavier pour l'accessibilité.
- Modèle de données inchangé : la liste ordonnée est `[photo_principale_url, ...urls_galerie]`. À chaque réordonnancement on écrit `photo_principale_url = liste[0]` et `urls_galerie = liste.slice(1)` via un seul `update(...).select()` sur `prestataires`, puis `onUpdate()`.
- État local optimiste de l'ordre, resynchronisé sur les props ; rollback si l'update renvoie une erreur ou zéro ligne.
- Dépôt de fichiers : handlers `onDragOver` / `onDragLeave` / `onDrop` sur le conteneur, lecture de `e.dataTransfer.files`, réutilisation de la fonction `uploadFiles` existante (filtrage type/taille, upload bucket `prestataires-photos`, URL publique).
- Aucun changement de schéma ni de code côté fiche publique : `FicheGalerie` consomme déjà `photoUrl` puis `galerie` dans l'ordre.
