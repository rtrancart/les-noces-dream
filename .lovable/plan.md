
## État actuel

Migrations DB **déjà exécutées et approuvées** :
- Vue `public.prestataires_public_all` (miroir de `prestataires_public` sans filtre statut) — accès direct **verrouillé** (`REVOKE ALL` pour anon/authenticated, `security_invoker = true`).
- RPC `get_prestataire_preview(slug text)` et `get_prestataire_preview_by_id(id uuid)` en SECURITY DEFINER, `GRANT EXECUTE` uniquement à `authenticated`, contrôle d'accès `admin | super_admin | user_id = auth.uid()`.

## Reste à implémenter (frontend, build mode)

### 1. Extraction du rendu (aucune régression visuelle attendue)

`src/components/fiche/FichePrestataireView.tsx` — nouveau composant présentationnel qui reçoit toutes les données en props (`presta`, `catMere`, `catFille`, `avis`, `champsCategorie`, `similaires`, `previewMode?`, `onAvisRefetch?`). Contient l'intégralité du JSX actuellement dans `FichePrestataire.tsx`. En `previewMode` :
- Bandeau ambre en tête : « Prévisualisation — cette fiche n'est pas visible du public (statut : …) ».
- `SeoHead noindex`, aucun `<JsonLd>`.
- `FavoriButton`, `FicheDevisSidebar`, `FicheStickyMobileCTA`, `FicheDevisDialog`, section « Prestataires similaires » masqués.
- `trackEvent`/`trackRevealPhone` désactivés sur la révélation du téléphone.

### 2. Slim-down de la page publique

`src/pages/FichePrestataire.tsx` — devient un conteneur de fetch (via `prestataires_public`, `statut='actif'`) + tracking (`useTrackVisitePrestataire`, `vue_profil`) + rendu `<FichePrestataireView />`. Aucun changement fonctionnel côté public.

### 3. Nouvelle page de preview

`src/pages/FichePrestatairePreview.tsx` — appelle `supabase.rpc('get_prestataire_preview'|_by_id')` selon les params de route, gère `loading / forbidden / not_found / ok`, puis rend `<FichePrestataireView previewMode />`. Aucun tracking. Similaires omis.

### 4. Routes

Dans `src/App.tsx`, ajouter deux routes SPA protégées, hors `PublicLayout` :

```tsx
<Route path="/prestataire/:slug/preview" element={<ProtectedRoute><FichePrestatairePreview /></ProtectedRoute>} />
<Route path="/prestataire/id/:id/preview" element={<ProtectedRoute><FichePrestatairePreview /></ProtectedRoute>} />
```

### 5. Points d'accès UI

- **Espace prestataire** : bouton « Prévisualiser ma fiche » (icône `Eye`) ajouté dans `PrestataireSidebar` (juste au-dessus du bloc déconnexion) — ouvre `/prestataire/{slug}/preview` dans un nouvel onglet. Actif quel que soit le statut, désactivé uniquement si le slug est manquant (fallback vers `/prestataire/id/{id}/preview`).
- **Back-office admin** : dans `src/pages/admin/Prestataires.tsx`, ajouter à chaque ligne un bouton icône `Eye` (title="Prévisualiser") avant le crayon d'édition, pointant vers `/prestataire/{slug}/preview` (nouvel onglet).

### 6. Non-indexation

`public/robots.txt` — ajouter `Disallow: /*/preview` dans les blocs pertinents (à minima sous `User-agent: *`, `Googlebot`, `Bingbot` et les crawlers IA). La route n'est de toute façon jamais dans le sitemap.

## Ce qui NE change PAS

- Aucune modification des règles de publication, des triggers, du statut, de `charte_ok_pour_publication`, de l'abonnement, du parcours d'inscription ou d'import.
- Aucune modification de RLS existante.
- Aucun changement visuel de la fiche publique (le refactor est un pur déplacement de JSX).

## Fichiers touchés

```text
src/components/fiche/FichePrestataireView.tsx   (nouveau)
src/pages/FichePrestataire.tsx                  (allégé)
src/pages/FichePrestatairePreview.tsx           (nouveau)
src/App.tsx                                     (2 routes)
src/components/prestataire/PrestataireSidebar.tsx  (bouton preview)
src/pages/admin/Prestataires.tsx                (bouton preview par ligne)
public/robots.txt                               (Disallow /*/preview)
.lovable/plan.md                                (mise à jour)
```
