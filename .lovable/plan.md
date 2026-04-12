

## Plan : Formulaire de devis compact et dépliable + header réorganisé

### Problèmes identifiés
1. Le formulaire de devis sidebar affiche 8 champs + bouton, ce qui dépasse la hauteur d'un écran standard — il ne commence à scroller qu'après avoir scrollé tout le contenu au-dessus
2. Le bandeau d'infos en haut (nom, badges, localisation, prix, zones) manque de structure visuelle

### Solution proposée

**Formulaire dépliable (FicheDevisSidebar.tsx)**
- Afficher par défaut uniquement : Nom, Email, Message (3 champs) + bouton "Envoyer"
- Quand l'utilisateur clique/focus sur un champ, déplier automatiquement les champs supplémentaires (téléphone, type d'événement, date, invités, lieu) avec une animation fluide via Collapsible
- Un état `expanded` passe à `true` au premier `onFocus` sur n'importe quel champ
- Le formulaire reste compact (~250px) quand replié, ce qui le rend visible entièrement dès le haut de la page
- Les champs secondaires apparaissent en transition douce

**Header réorganisé (FichePrestataire.tsx)**
- Ligne 1 : Nom + badges (Premium, Vérifié, catégorie) + bouton favori — inchangé
- Ligne 2 : Regrouper localisation, note et prix sur une seule ligne avec des séparateurs visuels (·) pour un rendu plus compact et lisible
- Zones d'intervention : garder en dessous, inchangé

### Fichiers modifiés
1. **`src/components/fiche/FicheDevisSidebar.tsx`** — Ajouter état `expanded`, wrapper Collapsible autour des champs secondaires, déclencher l'expansion au focus
2. **`src/pages/FichePrestataire.tsx`** — Réorganiser le bloc header (lignes 250-332) pour un affichage plus compact avec séparateurs

