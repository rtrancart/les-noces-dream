
## Analyse mobile de la page historique

**Problèmes identifiés sur 390px :**

1. **Pills de filtres** : avec 10+ catégories, les pills `flex-wrap` créent 4-5 lignes qui poussent le contenu vers le bas. Mauvaise lisibilité.
2. **Bouton "Tout effacer"** : prend une ligne entière sous le titre à cause du `flex-wrap`, alourdit le header.
3. **Sous-titre stats** : "X fiches · Y catégories · 90 jours" — info redondante avec les compteurs déjà visibles dans les pills.

## Plan d'amélioration

### 1. Filtres en scroll horizontal sur mobile
Remplacer `flex-wrap` par un scroll horizontal one-line sur mobile (`overflow-x-auto` + `flex-nowrap`), garder le wrap sur desktop (`sm:flex-wrap`). Ajouter un masque dégradé à droite pour signaler le scroll. Pills légèrement plus compactes.

### 2. CTA "Tout effacer" : icône seule sur mobile
- Mobile (<640px) : bouton icône carré (juste `<Trash2 />`) sur la même ligne que le titre, alignement à droite via `justify-between` (sans `flex-wrap`).
- Desktop : conserver le bouton avec texte "Tout effacer".
- Ajouter un `aria-label` et un `title` pour l'accessibilité.

### 3. Suppression de la ligne stats
Retirer le `<p>` "X fiches · Y catégories · 90 jours" dans les deux pages. Les compteurs des pills suffisent. Conserver uniquement le titre (h1).

### 4. Application sur les deux pages
Modifier de manière cohérente :
- `src/pages/client/Historique.tsx`
- `src/pages/PrestatairesConsultes.tsx` (garder le breadcrumb)
- `src/components/historique/HistoriqueByCategory.tsx` (filtres en scroll horizontal)

### Détails techniques

```tsx
// Header — same line on mobile
<div className="flex items-center justify-between gap-3">
  <h1 className="font-serif text-2xl sm:text-3xl">Prestataires consultés</h1>
  {entries.length > 0 && (
    <Button variant="outline" size="sm" onClick={clearAll}
      className="text-destructive hover:text-destructive shrink-0"
      aria-label="Tout effacer">
      <Trash2 className="h-4 w-4 sm:mr-2" />
      <span className="hidden sm:inline">Tout effacer</span>
    </Button>
  )}
</div>

// Filter pills — horizontal scroll on mobile
<div className="flex gap-2 overflow-x-auto sm:flex-wrap pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
  {/* pills with shrink-0 */}
</div>
```

Aucune modification BDD. Aucun changement de logique.
