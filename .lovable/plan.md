## Phase 9 — SEO & JSON-LD : plan final (v3)

Les deux points soulevés sont tranchés par vérif directe.

---

### Vérif 1 — Paramètre de recherche

`src/pages/Recherche.tsx` lit uniquement `lieu`, `categorie`, `ville`. **Aucun `q` plein-texte n'existe.** Conséquence : la `SearchAction` du `WebSite` JSON-LD ne peut pas pointer vers `?q=…`.

**Décision** : ne pas émettre de `SearchAction` du tout dans la v1. Implémenter une vraie recherche plein-texte est hors scope Phase 9 (toucherait Recherche.tsx + requêtes Supabase). Mieux vaut pas de Sitelinks Search Box que des résultats vides. À reproposer ultérieurement si une recherche libre est ajoutée.

Le `WebSite` JSON-LD sitewide reste émis (name, url, alternateName, inLanguage), juste sans `potentialAction`.

---

### Vérif 2 — Catégories mères réelles (22)

Liste exacte tirée de `categories WHERE parent_id IS NULL AND est_active = true` :

`lieux-de-reception`, `hebergements`, `traiteur-gastronomie`, `photographe-videaste`, `musicien-dj`, `fleuriste`, `artificier`, `decoration`, `wedding-planner`, `vetements-mariage`, `animation`, `transport-vehicules`, `location-de-materiel`, `bijoux-de-mariage`, `beaute`, `faire-parts`, `officiant-de-ceremonie`, `barmen`, `caviste-domaine-viticole`, `agents-de-securite`, `service-de-menage`, `nounous-et-animatrice-enfants`.

Pas de `chateaux-domaines` (les châteaux sont des sous-catégories de `lieux-de-reception`). En revanche `hebergements` et `caviste-domaine-viticole` désignent aussi des établissements physiques avec adresse publique.

**Mapping retenu** (set explicite, défaut sûr = `ProfessionalService`) :

```ts
const LOCAL_BUSINESS_SLUGS = new Set([
  "lieux-de-reception",
  "hebergements",
  "caviste-domaine-viticole",
]);
```

Tout autre slug → `ProfessionalService`.

---

### Robustesse adresse (nouveau garde-fou)

Même quand le slug mappe sur `LocalBusiness`, **on n'émet le `@type` LocalBusiness que si l'adresse est exploitable**. Règle dans le builder :

```ts
function pickProviderType(slugMere, presta) {
  const wantsLocal = LOCAL_BUSINESS_SLUGS.has(slugMere);
  const hasUsableAddress =
    Boolean(presta.ville?.trim()) &&
    presta.ville !== "À compléter" &&
    Boolean(presta.adresse_postale?.trim() || presta.code_postal?.trim());
  if (wantsLocal && hasUsableAddress) return "LocalBusiness";
  return "ProfessionalService";
}
```

Et côté `address` :
- Émis uniquement si `LocalBusiness` retenu (donc adresse exploitable).
- Si pour une raison X un champ partiel manque, on omet la propriété plutôt que d'émettre une `PostalAddress` avec des chaînes vides.

→ Zéro `LocalBusiness` flaggé "invalid" par Google.

---

### Étape 0 — Pré-requis URL canoniques (bloquante)

1. `supabase/functions/generate-sitemap/index.ts` :
   - Catégories mères → `/prestataires/${slug}` (au lieu de `/recherche?categorie=`).
   - Ajouter un select des sous-catégories actives + leur parent_slug, émettre `/prestataires/${parentSlug}/${slug}`.
   - Plus aucune URL `/recherche?...` dans le sitemap.
2. `public/robots.txt` : directive `Sitemap:` pointant l'edge function (URL absolue) ou `/sitemap.xml` si rewrite déjà en place — à vérifier au moment de l'implémentation.
3. Confirmer que `PrestatairesListe.tsx` émet bien son canonical sur sa propre URL slug (audit visuel rapide).

---

### Étape 1 — Socle sitewide

- `index.html` : JSON-LD `Organization` (logo, sameAs réseaux) + `WebSite` (name, url, alternateName, inLanguage `fr-FR`, **sans `potentialAction`**).
- `src/components/JsonLd.tsx` (wrapper Helmet pour `<script type="application/ld+json">`).
- `src/lib/jsonld.ts` : builders typés purs + `buildBreadcrumbJsonLd(items)` + map `LOCAL_BUSINESS_SLUGS` + `pickProviderType()` + helper `resolveAbsoluteUrl` (extrait/exposé depuis `seo.ts`).

### Étape 2 — Fiches prestataires (`FichePrestataire.tsx`)

- `@type` conditionnel via `pickProviderType(slugMere, presta)`.
- Toujours : `name`, `url` (canonical), `image`, `description`, `areaServed`, `dateModified` ← `updated_at` (ISO 8601).
- Si `LocalBusiness` retenu : `address` (PostalAddress complet) + `geo` si lat/lng.
- `priceRange` : émis seulement si `prix_depart` OU `prix_max` ≠ NULL ; format `"€{min}–€{max}"` ou `"À partir de €{min}"`. Pas de symboles `€€€`.
- `aggregateRating` : émis seulement si `nombre_avis > 0`.
- `review` : 3 derniers `avis` valides max.
- `makesOffer` si prestations principales renseignées.
- `BreadcrumbList` : Accueil › `/prestataires/:slugMere` (nom catégorie) › fiche.

### Étape 3 — Listes catégories (`PrestatairesListe.tsx`)

- `CollectionPage` + `ItemList` (top 10 affichés, position + URL absolue fiche).
- `BreadcrumbList` : Accueil › Catégorie mère › (Sous-catégorie).
- Canonical = URL slug courante.

### Étape 4 — Régions (`MariageRegion.tsx`)

- Ajouter `BreadcrumbList` (Accueil › Mariage › Région).
- Scinder en deux scripts JSON-LD séparés : `WebPage` et `FAQPage` (au lieu de `hasPart`).
- `aggregateRating` régional : déjà conditionné, OK.

### Étape 5 — Blog

- `BlogArticle.tsx` : `Article` (`headline`, `datePublished`, `dateModified`, `author`, `image`, `publisher`).
- `Blog.tsx` : `Blog` + `ItemList`.
- `BreadcrumbList` sur les deux.

### Étape 6 — Homepage & Recherche

- `Index.tsx` : `ItemList` des catégories phares pointant vers `/prestataires/:slugMere` (pas de `Organization`/`WebSite` redondants, déjà dans `index.html`).
- `Recherche.tsx` :
  - Canonical = `/recherche` (sans param) en toute situation.
  - `noindex` dès qu'au moins un `searchParam` est présent.
  - Aucun JSON-LD spécifique.

### Étape 7 — QA

- Étendre `seoAllPages.test.tsx` : pour chaque route majeure, asserter présence d'un JSON-LD du bon `@type`.
- Tests unitaires builders : `priceRange` (null/null absent, un seul, les deux) ; `aggregateRating` (0 avis absent) ; `pickProviderType` (slug local + adresse OK → LocalBusiness ; slug local + adresse vide → ProfessionalService ; slug non local → ProfessionalService).
- Vérification manuelle Google Rich Results Test : 1 URL par type.

---

### Checklist par page

| Page | Canonical | OG | JSON-LD | Breadcrumb |
|---|---|---|---|---|
| `/` | ✅ | ✅ | `WebSite`+`Organization` (sitewide) + `ItemList` cat. | — |
| `/recherche` | `/recherche` | ✅ | — | — |
| `/recherche?…` | `/recherche` | ✅ | — | + `noindex` |
| `/prestataire/:slug` | ✅ | ✅ | `LocalBusiness` ou `ProfessionalService` (cond.) + `AggregateRating`* + `Review`* + `dateModified` | ✅ |
| `/prestataires/:m[/:s]` | ✅ | ✅ | `CollectionPage`+`ItemList` | ✅ |
| `/mariage/:slug` | ✅ | ✅ | `WebPage` + `FAQPage` séparés + `AggregateRating`* | ✅ (ajout) |
| `/blog` | ✅ | ✅ | `Blog`+`ItemList` | ✅ |
| `/blog/:slug` | ✅ | ✅ | `Article` (+`dateModified`) | ✅ |

`*` = conditionnel (émis seulement si données suffisantes).

---

### Hors scope (renvoyé Phases 10/11)

- WebP, lazy-loading, `fetchpriority` → Phase 10.
- `llms.txt`, E-E-A-T, balises IA → Phase 11.
- Recherche plein-texte `?q=…` + `SearchAction` → chantier produit séparé.

Le plan est prêt à être implémenté tel quel — clique sur **Implement plan** quand tu veux que j'attaque.
