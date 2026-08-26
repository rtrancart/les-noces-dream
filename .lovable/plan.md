# Réconciliation nocturne de la file de pré-rendu

## Audit

### 1. Source de vérité des pages indexables
`supabase/functions/generate-sitemap/index.ts` recense les URL avec exactement ces filtres :

| Type | Requête | URL |
|---|---|---|
| statiques | liste en dur (5 entrées) | `/`, `/recherche`, `/blog`, `/connexion`, `/inscription` |
| régions | `pages_regions_mariage` où `est_publiee` | `/mariage/{slug_region}` |
| catégories mères | `categories` où `est_active` et `parent_id is null` | `/prestataires/{slug}` |
| catégories filles | `categories` où `est_active` et `parent_id not null` | `/prestataires/{slug_mere}/{slug_fille}` |
| articles | `articles_blog` où `est_publie`, hors `noindex`, hors `inclure_sitemap = false` | `/blog/{slug}` |
| fiches | `prestataires` où `statut = 'actif'` | `/prestataire/{slug}` |

Point à noter : le sitemap **n'inclut pas** `pages_contenu` (pages éditoriales), alors que l'énoncé les mentionne. La logique est aujourd'hui inline dans la fonction sitemap — pour ne pas la dupliquer, elle sera extraite dans un module partagé `supabase/functions/_shared/pages-indexables.ts`, consommé à la fois par `generate-sitemap` et par la réconciliation. Le générateur de sitemap garde un rendu strictement identique.

Volumes actuels : 32 fiches actives, 47 catégories, 13 régions, 25 articles, 2 pages éditoriales, 5 statiques — soit ~120 pages. Ce chiffre montera à plusieurs milliers quand les 3 230 fiches migrées passeront en `actif`.

### 2. Empreintes de contenu visible
`prerender_queue.signature_visible` existe (`text`, nullable) mais **rien ne l'alimente** : la file compte 4 lignes, toutes créées à la main. Le consommateur, `prerender-snapshots-batch`, se contente de comparer `signature_visible` à `signature_rendue` (court-circuit) et de recopier la première dans la seconde après rendu — il ne calcule aucune empreinte. C'est donc au mécanisme de réconciliation de la produire.

Le calcul sera fait **en SQL**, côté base, dans une fonction `security definer` : `md5` sur une concaténation ordonnée des champs réellement affichés, jamais les champs internes ni `updated_at`.

- fiche : `nom_commercial, description, description_courte, prix_depart, prix_max, ville, region, zones_intervention, photo_principale_url, urls_galerie, tags, champs_specifiques, video_url, site_web, categorie_mere_id, categorie_fille_id, note_moyenne, nombre_avis, est_premium, est_verifie` + empreinte agrégée des avis validés
- catégorie : `nom, slug, description_seo, contenu_seo, photo_url, icone_url, ordre_affichage` (+ pour une mère, la liste ordonnée des slugs de filles actives)
- région : `nom_region, intro_editoriale, specificites, conseils, faq, budgets, contenu_seo_bas, image_hero_url, meta_*`
- article : `titre, extrait, contenu, image_couverture_url, faq, meta_*, auteur, temps_lecture`
- statique : empreinte constante (rendu piloté par des données globales) — remise à traiter uniquement si absente

### 3. Modèle des tâches nocturnes
Toutes les tâches sont déclarées en `pg_cron` (`cron.schedule`) et appellent la fonction via `net.http_post`, avec un `Authorization: Bearer` lu dans `vault.decrypted_secrets` (`email_queue_service_role_key`) — c'est le modèle retenu (ex. `brevo-sync-compteurs-nightly`, 04:00).

Pour la reprise par lots, `brevo-sync-compteurs` fournit le modèle exact : budget `BUDGET_MS = 40 s`, boucle interne, puis **auto-relance** par `fetch` sur sa propre URL avec l'offset courant, et compte-rendu `{ ok, termine, offset_final, ... }`. C'est ce modèle qui sera repris.

### 4. Suppression d'un fichier du bucket
Client `service_role` puis `supabase.storage.from('prerender-snapshots').remove([storage_path])` — le bucket existe, il est public en lecture seule, l'écriture/suppression passe par le `service_role`.

### 5. Points coûteux / risqués à l'échelle
- **Recalcul intégral des empreintes chaque nuit** : à 3 300 fiches, l'agrégat des avis par fiche est le poste lourd. Il sera calculé en une seule requête ensembliste (jointure groupée), pas fiche par fiche, et paginé par tranches de 500.
- **Comparaison en base, pas en mémoire** : la réconciliation ne charge jamais l'ensemble des pages côté Deno ; le calcul, la comparaison et l'`upsert` se font dans une fonction SQL travaillant par tranches.
- **Risque de remise à traiter massive** : si une empreinte change de définition (ajout d'un champ), toute la file repasse `a_traiter` → 3 300 rendus séquentiels à ~5 s = plusieurs heures. Un plafond quotidien de mises en file sera prévu, paramétrable.
- **Suppressions destructrices** : une erreur de filtre viderait le bucket. Garde-fou : si la réconciliation veut supprimer plus de X % de la file en une passe, elle s'arrête et journalise sans rien effacer.
- **Durée du traitement** : 3 300 pages × (rendu + pause 1,5 s) dépasse largement une nuit. Le déclenchement bouclera dans une limite de temps bornée et reprendra la nuit suivante — la file étant triée par `updated_at`, aucune page n'est jamais laissée de côté indéfiniment.
- Les entrées `abandonne` (3 échecs) ne sont pas rejouées par la réconciliation tant que leur empreinte n'a pas changé, ce qui évite de boucler sur des pages cassées.

## Découpage proposé

1. **Module partagé** `_shared/pages-indexables.ts` : extraction de la logique de recensement du sitemap (mêmes filtres, mêmes URL), réutilisé par `generate-sitemap` sans changement de sortie.
2. **Migration** : fonction SQL `prerender_reconcilier(p_limit, p_offset)` qui calcule les empreintes visibles par tranche et fait l'`upsert` dans `prerender_queue` (insertion → `a_traiter`, empreinte changée → `a_traiter`, inchangée → rien), plus une fonction listant les entrées orphelines à purger.
3. **Fonction `prerender-reconcile`** : garde `service_role` + admin (même modèle que `prerender-snapshots-batch`), passes bornées à 40 s avec auto-relance par offset, purge des orphelins (suppression bucket puis suppression de ligne), compte-rendu `{ ajoutees, remises, inchangees, purgees, restantes }`.
4. **Fonction `cron-prerender-nightly`** : appelle la réconciliation jusqu'à `termine`, puis boucle sur `prerender-snapshots-batch` jusqu'à `restantes = 0` ou épuisement du budget de nuit, séquentiellement, sans parallélisme.
5. **Planification** `pg_cron` une fois par nuit (proposition : 04:30, après le batch Brevo de 04:00), même en-tête `Authorization` depuis le vault.
6. **Panneau admin** : ajout d'un bouton « Synchroniser la file » dans `PrerenderSnapshotsPanel` pour déclencher la réconciliation à la demande, avec le même affichage de compteurs.

## Points à trancher

- Faut-il inclure les pages éditoriales `pages_contenu` (absentes du sitemap aujourd'hui) — et si oui, les ajouter aussi au sitemap ?
- Heure du cron : 04:30 convient-il ?
