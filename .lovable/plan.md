

## Mobile espace pro : bandeau compact + menu burger

### Fichiers modifiés
- `src/components/prestataire/ProviderInfoBanner.tsx`
- `src/components/prestataire/PrestataireSidebar.tsx`
- `src/components/prestataire/PrestataireLayout.tsx`

### 1. Bandeau compact sur mobile (`ProviderInfoBanner.tsx`)
- Réduire le padding mobile (`px-4 py-3` au lieu de `px-6 py-5`)
- Réduire la taille du nom (`text-lg` au lieu de `text-xl`)
- Remplacer le cercle SVG 64px par un affichage compact sur mobile : texte pourcentage + mini barre de progression horizontale (composant `Progress`)
- Garder le cercle SVG sur desktop (`hidden md:flex` / `flex md:hidden`)

### 2. Menu burger sur mobile (`PrestataireLayout.tsx`)
- Utiliser `useIsMobile()` pour détecter le mobile
- Sur mobile : afficher une **barre sticky** sous le bandeau avec un bouton burger (`Menu` icon) + le titre de la page active
- Le bouton ouvre un `Sheet` (side="left") contenant la `PrestataireSidebar`
- Le Sheet se ferme automatiquement après navigation (via prop `onNavigate`)
- Sur desktop (`lg+`) : garder le layout grid actuel inchangé

### 3. Sidebar adaptée (`PrestataireSidebar.tsx`)
- Ajouter une prop optionnelle `onNavigate?: () => void`
- Appeler `onNavigate()` au clic sur chaque lien
- Aucun changement visuel sur desktop

### Résultat mobile
```text
┌──────────────────────┐
│  Header              │
├──────────────────────┤
│ Nom · Premium  72%   │  ← bandeau compact
│ Ville · ████░░░░░░   │  ← mini progress bar
├──────────────────────┤
│ ☰ Ma galerie         │  ← barre sticky + burger
├──────────────────────┤
│                      │
│  Contenu principal   │
│                      │
└──────────────────────┘
```

