# Largeur pleine page pour les zones de texte (haut et bas)

## Constat

Sur les pages catégorie (`/prestataires/...`), la grille de fiches occupe toute la largeur du conteneur (max 1 400 px), mais les blocs de texte sont bridés par des largeurs maximales plus étroites :

- Bloc « L'essentiel » (haut de page, sous le H1) : `max-w-4xl` = 896 px
- Bloc « Comment choisir votre… » (bas de page) : `max-w-3xl` = 768 px
- FAQ, chips « Types de… », maillage régions, articles : `max-w-3xl`/`max-w-4xl`

Résultat : le texte en haut et en bas semble flotté au centre, plus étroit que la grille.

## Modification

Fichier unique : `src/pages/PrestatairesListe.tsx`

Supprimer les contraintes de largeur maximale pour que ces sections occupent toute la largeur du conteneur (alignées sur la grille) :

1. Section « Réponse d'emblée » : retirer `max-w-4xl`.
2. Section « Éditorial » (Comment choisir…) : retirer `max-w-3xl`.
3. Section « Types de… » (chips) : retirer `max-w-4xl`.
4. Section FAQ : retirer `max-w-3xl`.
5. Section « Se marier en région » : retirer `max-w-4xl`.
6. Section « À lire sur le magazine » : retirer `max-w-4xl`.

Le sous-titre sous le H1 (`max-w-3xl`) reste inchangé : c'est une ligne courte sous le titre, pas un bloc de contenu.

## Vérification

- Typecheck `bunx tsgo --noEmit -p tsconfig.app.json`.
- Capture Playwright de `/prestataires/lieux-de-reception` : le bloc « L'essentiel » et le bloc « Comment choisir » doivent s'aligner sur la largeur de la grille (bords gauche/droite identiques).
- Contrôle visuel desktop et mobile.
