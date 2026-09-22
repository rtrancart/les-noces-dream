# Pages catégorie : gabarit SEO/GEO réplicable

Objectif : un seul gabarit, appliqué d'abord à « Lieux de réception », valable pour toutes les catégories (mères et filles).

Note : la maquette https://claude.ai/artifact/DK6nM18LaaS866pYD3RJuc est protégée (Cloudflare), je ne peux pas la lire. Je reprends donc la structure de la page actuelle et l'identité « luxe éditorial » du site. Si la maquette impose une mise en page précise, collez son HTML dans le chat et je m'aligne dessus.

## A. Données (catégories)

Nouveaux champs sur les catégories, tous éditables depuis l'admin :

- `seo_intro` (markdown) — bloc « réponse d'emblée » en haut de page
- `seo_body` (markdown) — bloc éditorial bas de page
- `faq` (liste de questions/réponses)
- `meta_title`, `meta_description` — surcharges manuelles ; sinon gabarit automatique
- `nom_singulier` et `genre` (masculin/féminin) — indispensables pour un H1 et une meta corrects (« votre lieu de réception », « la meilleure fleuriste » vs « le meilleur photographe »). Renseignés pour les 23 catégories mères et leurs filles.
- Comptage des prestataires actifs par catégorie : vue dédiée, lue en une requête par la page (plus de dépendance au nombre de cartes chargées).

## B. Gabarit de page

- H1 : « Trouvez votre {singulier minuscule} de mariage » (+ « à {ville} » / « en {région} » selon l'URL). Corrige « votre Lieux de réception ».
- Fil d'ariane visible : Accueil › Prestataires › {Catégorie} (› {Sous-catégorie}).
- Bloc réponse d'emblée (`seo_intro`) juste sous le H1, avec le nombre de prestataires.
- Chips de liens vers les catégories filles (aujourd'hui aucun lien interne).
- Hiérarchie stricte : H1 unique, H2 pour les sections éditoriales, H3 pour les noms de prestataires dans les cartes.
- Note masquée quand 0 avis (fin du « ★ – »).
- Bloc éditorial `seo_body` (markdown rendu) en H2.
- FAQ en accordéon depuis le champ `faq`.
- Maillage : liens vers /mariage/{régions} pertinentes et vers les articles de blog liés à la catégorie.
- Mention « Mis à jour le {date} » basée sur la vraie date de modification de la catégorie.
- Meta description automatique, grammaticalement correcte, avec le nombre : « 36 lieux de réception de mariage… » / « 12 fleuristes… », accord singulier/pluriel/genre géré.

## C. Données structurées

Dans le HTML prérendu : `ItemList` (toutes les fiches de la grille, plus seulement 10), `BreadcrumbList` (identique au fil d'ariane), `FAQPage` uniquement si la catégorie a des Q/R réelles. Aucun `AggregateRating` sans avis.

## D. Prérendu et sitemap

- La page ne signale « prête » à la capture qu'une fois catégorie, comptage, prestataires, éditorial, FAQ et maillage chargés — le snapshot contient donc tout.
- Empreinte de changement élargie aux nouveaux champs (intro, corps, FAQ, metas) : toute modification en admin remet la page en file de capture.
- Contrôle de complétude : un snapshot dont le nombre de fiches ne correspond pas au comptage en base est refusé plutôt que publié.
- `lastmod` du sitemap : vraie date par page (catégorie, ses filles et ses prestataires actifs) au lieu d'une date globale identique partout.

## Détails techniques

- Migration : `ALTER TABLE public.categories` (seo_intro text, seo_body text, faq jsonb default '[]', meta_title text, meta_description text, nom_singulier text, genre text check masculin/feminin) ; vue `categories_compteurs` (id, nb_prestataires_actifs) + GRANT anon/authenticated ; mise à jour de `public.prerender_pages_indexables()` (signature + lastmod par catégorie) ; seed `nom_singulier`/`genre` par UPDATE.
- `src/pages/PrestatairesListe.tsx` : refonte du bloc `seo` (H1/metas via helper `src/lib/categorieLabels.ts` gérant accord et genre), sections intro/chips filles/éditorial/FAQ/maillage/breadcrumb/date, `usePrerenderStatus` étendu aux nouvelles requêtes.
- `src/lib/jsonld.ts` : `buildCategoryListJsonLd` sur la liste complète ; `buildCategoryFaqJsonLd` alimenté par le champ `faq` (remplace CATEGORY_FAQ_MAP codé en dur).
- `src/components/search/ProviderCard.tsx` : masquer la note si `nombre_avis = 0`.
- Admin catégories : champs seo_intro, seo_body, faq (éditeur de Q/R), metas, nom_singulier, genre.
- `prerender-snapshots-batch` : contrôle du nombre de cartes ; `_shared/pages-indexables.ts` : lastmod par page.
- Vérifications : typecheck, capture réelle de /prestataires/lieux-de-reception puis contrôle du HTML servi (fiches, FAQ, JSON-LD), puis contrôle sur 2 autres catégories (dont une catégorie fille et une catégorie féminine).
