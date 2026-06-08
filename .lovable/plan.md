## Contexte
Sur la carte des résultats de recherche, le popup Leaflet affiche le nom, la ville et la note du prestataire, mais ne permet pas d'accéder directement a sa fiche.

## Objectif
Ajouter un CTA "Voir la fiche" dans chaque popup de marqueur pour ouvrir la fiche prestataire (`/prestataire/:slug`), en desktop et mobile.

## Implémentation
Modifier `src/components/search/SearchMap.tsx` :

1. **Ajouter le CTA dans le contenu du popup** : enrichir le `bindPopup` HTML string avec un lien stylise "Voir la fiche".
2. **Navigation** : utiliser un `<a href="/prestataire/${p.slug}">` dans le HTML du popup. Leaflet popups utilisent du HTML brut, donc un lien standard `a` pointant vers une route interne du SPA est la solution la plus robuste.
3. **Styling desktop** : le lien sera stylise en CSS inline dans le popup pour matcher la charte (couleur or `#A57D27`, texte en gras, petite marge en haut pour le separer des infos).
4. **Styling mobile** : le lien doit avoir une zone tactile confortable (min-height 44px, padding genereux) car les popups Leaflet sur mobile sont interactifs au tap. Pas de comportement special necessaire, Leaflet gere le touch natif.

### Ajustement technique
- Le `ProviderCardData` contient deja le `slug` necessaire.
- Aucune dépendance supplémentaire necessaire.
- Sur mobile, la carte est affichee en plein ecran via `showMobileMap`, le popup fonctionne identiquement (tap sur le marqueur, tap sur le lien).

## Fichier concerne
- `src/components/search/SearchMap.tsx`
