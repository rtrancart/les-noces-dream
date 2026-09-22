# Roadmap — Gabarit de page catégorie SEO/GEO/UX

## Fait
- [x] A. Modèle de données catégories : seo_intro, seo_body, faq, meta_title, meta_description, nom_singulier, genre (+ vue categories_compteurs, GRANT anon/authenticated)
- [x] A bis. Seed nom_singulier/genre des 47 catégories + contenu éditorial « Lieux de réception »
- [x] B. Template : src/lib/categorieLabels.ts (accords), refonte de PrestatairesListe.tsx (fil d'ariane, H1 corrigé, réponse d'emblée, grille, conseils markdown, chips filles, FAQ <details>, maillage régions + blog, « Mis à jour le »), metas auto surchargeables
- [x] B bis. ProviderCard : note masquée sans avis (badge « Nouveau »), alt image nom + catégorie + ville, CTA « Voir la fiche »
- [x] C. JSON-LD : ItemList sur toute la grille, BreadcrumbList, FAQPage alimenté par le champ faq (FAQ codées en dur supprimées), aucun AggregateRating sans avis
- [x] D1. prerender-serve : snapshot servi seulement si à jour, sans erreur, empreintes identiques, non périmé (≤ 168 h) ; sinon application normale
- [x] D2. prerender-snapshots-batch : contrôle de complétude des pages catégorie (nb de fiches capturées vs base), snapshot incomplet refusé et reprogrammé
- [x] D3. Signal __PRERENDER_READY__ posé après catégorie, comptage, prestataires, éditorial, FAQ et maillage
- [x] D4. Empreinte de changement élargie aux nouveaux champs + articles liés ; enregistrement en admin ⇒ remise en file immédiate
- [x] D5. Surveillance : alerte « Pages bloquées avant publication aux moteurs » (abandon ou attente > 12 h)
- [x] D6. Sitemap : lastmod déjà par page (vérifié côté base), aucune date globale
- [x] E. Admin catégories : éditeur complet (markdown + aperçu, FAQ répétable, metas avec compteur et aperçu SERP, nom_singulier/genre obligatoires, compteur lecture seule, lien « Voir la page », date de modif)

## Reste (bloqué sur publication)
- [ ] Capture réelle + contrôle du HTML servi à Googlebot sur /prestataires/lieux-de-reception, une catégorie fille et une catégorie féminine : à faire APRÈS publication (le moteur de capture rend le site publié)
