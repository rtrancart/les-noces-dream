# Galerie prestataire — dimensions et validation des photos

## Objectif
Dans l’espace prestataire (`/espace-pro/galerie`), ajouter une phrase informative sous le titre indiquant les dimensions recommandées, et renforcer l’upload avec une validation côté client (taille, format, dimensions minimales).

## Recommandation de dimensions affichée
Phrase sous le titre :
> « Photos en format paysage recommandé : 1200 × 800 px minimum, 5 Mo maximum. Formats acceptés : JPG, PNG, WebP. »

Justification : la galerie affiche les vignettes en ratio 4:3 (`aspect-[4/3]`) et le profil public sert les images en 1200 px de large (`cover`). Le paysage évite les recadrages importants.

## Changements prévus

### 1. Wording informatif
- Fichier : `src/pages/prestataire/Galerie.tsx`
- Ajouter sous le titre `Photos & galerie` un bloc de texte discret (`text-sm text-muted-foreground`) reprenant la phrase ci-dessus.

### 2. Validation côté client avant upload
Toujours dans `src/pages/prestataire/Galerie.tsx`, enrichir `handleUpload` :
- **Taille** : refuser les fichiers > 5 Mo (aligné avec l’onglet admin `PrestatairePhotosTab`).
- **Format** : accepter uniquement `image/jpeg`, `image/png`, `image/webp` (l’input `accept="image/*"` reste, mais la validation est explicite).
- **Dimensions** : lire chaque image via `URL.createObjectURL` + `Image`, exiger une largeur minimale de 800 px et une hauteur minimale de 600 px. Refuser les fichiers trop petits avec un message clair.
- Les fichiers invalidés sont ignorés individuellement ; les fichiers valides continuent l’upload. Un toast récapitule les erreurs si au moins un fichier est rejeté.

### 3. Alignement avec l’admin
L’onglet admin `PrestatairePhotosTab.tsx` limite déjà à 5 Mo et gère le glisser-déposer. Aucun changement n’est prévu côté admin : la validation côté prestataire reste indépendante.

## Non inclus
- Pas de modification du bucket `prestataires-photos`.
- Pas de validation serveur supplémentaire (RLS/policies inchangées).
- Pas de redimensionnement automatique côté client.

## Vérification
- `npx tsgo --noEmit` doit passer.
- Test visuel : la phrase apparaît sous le titre, l’upload d’une image trop lourde ou trop petite est bloqué avec un toast explicite.
