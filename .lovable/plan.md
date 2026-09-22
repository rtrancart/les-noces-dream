# Gabarit de page catégorie SEO / GEO / UX

Appliqué d'abord à « Lieux de réception », réplicable à toutes les catégories mères et filles. Design system existant conservé (taupe/or, serif éditorial, cartes arrondies) : on ajoute de la structure et du contenu, pas un nouveau style. Tout le contenu vit dans le HTML prérendu ; tous les liens de maillage sont de vrais liens.

## Structure de la page

1. Header et navigation existants.
2. Fil d'ariane : Accueil › Prestataires › {Catégorie} (› {Sous-catégorie}).
3. H1 « Trouvez votre {nom_singulier} de mariage » (+ « à {ville} » / « en {région} ») — corrige « Trouvez votre Lieux de réception ».
4. Bloc « réponse d'emblée » (seo_intro) sous le H1, visuellement distinct, avec le nombre réel de prestataires actifs. Texte de départ fourni pour les lieux de réception.
5. Pas de barre de filtres en haut de page (correction demandée) : la grille suit directement le bloc d'intro. Les filtres existants par zone/rayon restent pilotés par l'URL.
6. Grille de cartes : image avec alt « nom, catégorie à ville », H3 = nom, « ville · région », description courte, favori, CTA « Voir la fiche ». Aucune note affichée quand 0 avis — badge « Nouveau sur LesNoces.net » à la place.
7. H2 « Comment choisir votre {nom_singulier} » (seo_body en markdown, sous-points en H3) : capacité assise + 10 %, traiteur libre ou imposé (jusqu'à 40 % du budget), distance avec la cérémonie, hébergement sur place.
8. H3 « Types de {catégorie} » : chips = vrais liens vers les catégories filles réelles (/prestataires/lieux-de-reception/{slug}).
9. H3 « Budget et fourchettes de prix » : 15 à 20 % du budget total, 3 000 à 9 000 € pour un domaine, 6 000 à 20 000 € pour un château en haute saison.
10. H2 « Questions fréquentes » : accordéon `<details>`, réponses présentes dans le markup. 4 questions de départ (délai de réservation, budget location, traiteur externe, absence de commission).
11. H2 « À lire sur le magazine » : vrais liens vers les articles de blog liés à la catégorie.
12. Mention « Mis à jour le {date} » (vraie date de modification de la catégorie).
13. Footer existant.

Hiérarchie stricte : un seul H1, H2 pour les sections éditoriales, H3 pour les prestataires et sous-sections.

## A. Modèle de données

- `ALTER TABLE public.categories` : seo_intro (text), seo_body (text), faq (jsonb default '[]'), meta_title, meta_description, nom_singulier, genre (contrainte masculin/feminin).
- nom_singulier et genre renseignés pour les 23 catégories mères et toutes les filles ; sauvegarde admin bloquée s'ils manquent.
- Vue `categories_compteurs` (id, nb_prestataires_actifs) + GRANT anon/authenticated, lue en une requête par la page.

## B. Template

- Helper `src/lib/categorieLabels.ts` : accord singulier/pluriel/genre pour H1, sous-titre et metas (« les meilleurs photographes », « les meilleures décorations », jamais « les meilleurs fleuriste »).
- `src/pages/PrestatairesListe.tsx` : toutes les sections ci-dessus, meta description auto-générée avec le nombre réel, surchargeable par meta_description (et meta_title).

## C. Données structurées

- ItemList sur toute la grille affichée (plus de plafond à 10).
- BreadcrumbList identique au fil d'ariane.
- FAQPage alimenté par le champ faq, émis seulement s'il contient de vraies Q/R (remplace CATEGORY_FAQ_MAP).
- Jamais d'AggregateRating sans avis réels.

## D. Fiabilité du prérendu et sitemap

1. `prerender-serve` ne sert un snapshot que s'il est à jour, sans erreur, avec empreintes visible et rendue identiques ; sinon l'application normale, jamais un fichier périmé.
2. Contrôle de complétude après capture : nombre de cartes capturées comparé au nombre de prestataires actifs ; snapshot incomplet refusé et reprogrammé.
3. Signal « prête » posé seulement après catégorie, comptage, prestataires, seo_intro, seo_body, FAQ et maillage.
4. Empreinte élargie aux nouveaux champs ; enregistrement en admin = remise en file immédiate de la catégorie et de ses filles.
5. Surveillance : alerte si une page reste en attente/abandon ou si son snapshot dépasse l'âge maximal (ajout au garde-fou horaire existant).
6. Sitemap : lastmod = vraie date de modification par page (catégorie, filles, prestataires actifs).

## E. Interface admin

Sur chaque catégorie, en création comme en édition : seo_intro et seo_body en markdown avec aperçu, éditeur répétable de Q/R (ajout, suppression, réordonnancement), meta_title et meta_description avec compteur et aperçu SERP (valeur auto affichée par défaut, champ vidé = retour à l'auto), nom_singulier et genre obligatoires, nombre de prestataires actifs en lecture seule, lien « Voir la page » et date de dernière modification, remise en file de capture à l'enregistrement.

## Vérifications

Typecheck, capture réelle de /prestataires/lieux-de-reception puis contrôle du HTML servi à Googlebot (toutes les fiches, seo_intro, seo_body, FAQ avec réponses, liens filles/régions/blog, 3 blocs JSON-LD), puis même contrôle sur une catégorie fille et une catégorie féminine.

## Détails techniques

Fichiers touchés : migration categories + vue ; `src/lib/categorieLabels.ts` (nouveau) ; `src/pages/PrestatairesListe.tsx` ; `src/lib/jsonld.ts` ; `src/components/search/ProviderCard.tsx` ; `src/pages/admin/Categories.tsx` ; `supabase/functions/prerender-serve`, `prerender-snapshots-batch`, `_shared/pages-indexables.ts`, `cron-monitoring-alertes`.
