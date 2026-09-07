# Étape 1 — Supprimer les 4 comptes avec abonnement actif

## Comptes concernés
| Prestataire | Email | Abonnement | Souscription Stripe |
|---|---|---|---|
| Test presta | testprestalesnoces@gmail.com | Standard mensuel | oui |
| Camille Thuille | camille.thuille@gmail.com | Standard mensuel | oui |
| Atelier Test Migration 2 | rodolphe.trancart+testmigration2@gmail.com | Standard mensuel | oui |
| Robe Atelier Marie | rdv@ateliermarie.fr | Premium mensuel | non (créé à la main) |

Suppression complète et irréversible : compte utilisateur, fiche prestataire, abonnement, avis, demandes, favoris et historique liés.

## Déroulé
1. Annulation immédiate des 3 souscriptions Stripe (et de leur client Stripe), via une fonction d'administration à usage unique protégée par le rôle super admin — les identifiants Stripe ne sont accessibles que côté serveur.
2. Vérification que les 3 souscriptions sont bien passées à « annulée » dans Stripe avant toute suppression en base.
3. Suppression des 4 comptes via le mécanisme d'administration existant (nettoyage en cascade puis suppression du compte de connexion), un par un, avec contrôle du résultat.
4. Contrôle final : plus aucune ligne d'abonnement en statut actif, plus aucune fiche ni compte pour ces 4 adresses.
5. Suppression de la fonction d'administration à usage unique.

## Points d'attention
- Les fiches « Camille Thuille » et « Robe Atelier Marie » ressemblent à de vrais prestataires : leur suppression efface aussi leurs demandes de devis et avis reçus.
- Les factures déjà émises restent conservées côté Stripe et côté comptabilité ; aucun remboursement n'est effectué (à demander explicitement si souhaité).
- Deux de ces fiches sont publiées : leurs pages publiques disparaîtront et les instantanés de pré-rendu correspondants seront nettoyés au passage nocturne.

---

# Étape 2 — Validation du plan de refonte Premium (audit, aucune modification)



## Verdict global
Le plan est faisable. Trois points doivent être corrigés avant implémentation : la valeur `annuel` (P1), la dépendance `est_premium` ↔ pré-rendu (P2/Q6), et l'absence totale de tests automatisés sur les fonctions Stripe (Q4).

## P1 — Schéma abonnements
Faisable. Constat en base : 3 231 lignes `essai/trialing`, 3 `standard_mensuel/actif`, 1 `premium_mensuel/actif`. **Aucune ligne `mensuel` ni `annuel`**, aucun `plan` NULL, aucun statut résilié/expiré.
Conséquence : la table de correspondance est plus simple que prévu, et le cas ambigu « annuel = Standard annuel » ne concerne aucune donnée réelle — la décision reste à prendre pour l'avenir, pas pour la migration.
Point de friction : `periodicite = 'essai'` mélange à nouveau un état de cycle de vie avec une périodicité. Recommandé : `periodicite` ∈ (mensuel, annuel) NOT NULL, l'essai restant porté par `statut='trialing'` + `fin_essai_le`, déjà présents et déjà utilisés par le webhook.

## P2 — Colonne est_premium
Faisable via trigger, avec deux réserves.
- Les 7 fiches `est_premium=true` sont toutes en statut `actif`, donc toutes visibles publiquement et toutes présentes dans la signature de pré-rendu. Leur passage à `false` régénérera leurs snapshots plus ceux des pages de catégorie/région qui les listent.
- `fin_premium` (2 fiches, 1 encore active) est une seconde source de vérité utilisée uniquement par la page d'accueil. Elle doit être traitée dans le même lot, sinon la page d'accueil continuera d'afficher un « premium » sans abonnement.
- Le trigger doit s'écrire sur `prestataires`, table qui porte déjà 11 triggers dont plusieurs BEFORE UPDATE bloquants (`prevent_direct_actif_write`, `prevent_origine_prestataire_modification`, `prevent_direct_exemption_write`). Un UPDATE ciblé sur la seule colonne `est_premium` les traverse sans erreur, mais réveille `trg_brevo_sync_prestataire` (AFTER INSERT OR UPDATE, non filtré par colonne) : chaque changement d'abonnement déclenchera un appel de synchronisation Brevo supplémentaire. À accepter ou à filtrer explicitement.

## P3 — Matrice upgrade/downgrade
La règle sur la seule dimension `formule` est saine et corrige la hiérarchie actuelle fausse (`annuel(3) > premium(2)`).
Le cas « changement de périodicité à formule constante sans proration » est le plus délicat : Stripe facture par défaut au changement de prix ; il faut `proration_behavior: 'none'` **et** un Subscription Schedule pour différer au renouvellement, sinon le montant annuel est prélevé immédiatement. Mensuel → annuel sans encaissement immédiat est un choix commercial à confirmer.
La centralisation dans `_shared/stripe-config.ts` est cohérente avec l'organisation existante (`_shared/` contient déjà brevo-client, pennylane-client, etc.) et supprime la triple duplication actuelle (`stripe-webhook:18`, `stripe-create-checkout:18`, `stripe-webhook-simulate:16`).
Attention : `stripe-webhook-simulate` est déployé **sans authentification** (commentaire « à supprimer après validation »). À supprimer avant d'ouvrir la grille Premium.

## P4 — Vue prestataires_public
La vue est un `SELECT` à colonnes explicites sur `prestataires` (statut = actif) et expose déjà `est_premium`, `fin_premium`, `video_url`. Ajouter des colonnes impose un `CREATE OR REPLACE VIEW` avec la liste complète dans le même ordre ; c'est suffisant tant qu'on **ajoute en fin de liste** et qu'on ne retire ni ne réordonne rien. Toute suppression de colonne (ex. `fin_premium`) exige un `DROP VIEW ... CASCADE` et la recréation de `prestataires_public_all` et des fonctions qui en dépendent (`get_prestataire_preview`).

## P5 — Signature de pré-rendu
Confirmé : la signature n'est **pas** dérivée automatiquement de toutes les colonnes publiques. C'est une liste écrite à la main (slug, nom, description courte, ville, région, photo, notes, nombre d'avis, prix, `est_premium`) répétée dans trois agrégats distincts (par catégorie mère, par catégorie fille, par fiche). Toute nouvelle colonne Premium devra être ajoutée manuellement aux trois endroits, sinon les snapshots ne se régénéreront pas.

---

## Réponses aux questions

**Q1** — 3 231 `essai/trialing`, 3 `standard_mensuel/actif`, 1 `premium_mensuel/actif`, 0 `mensuel`, 0 `annuel`, 0 NULL, aucun statut terminal. La correspondance proposée est correcte ; les branches `mensuel` et `annuel` sont mortes aujourd'hui, à garder par sécurité.

**Q2** — Deux triggers sur `abonnements` : `update_abonnements_updated_at` (BEFORE UPDATE) et `trg_brevo_sync_abonnement` (AFTER INSERT OR UPDATE, appel Brevo). Aucun trigger sur `prestataires` n'écrit dans `abonnements` **sauf** `trg_set_fin_essai_migration` (AFTER UPDATE OF user_id) qui pose `fin_essai_le` à +90 jours. Cascade possible mais bornée : activation de compte → écriture `abonnements` → futur trigger → écriture `prestataires.est_premium` → `trg_brevo_sync_prestataire`. Pas de boucle infinie tant que le nouveau trigger n'écrit que `est_premium` et qu'il sort tôt si la valeur est inchangée (garde `IS DISTINCT FROM` obligatoire).

**Q3** — `fin_premium` est lue par `src/pages/Index.tsx` (sélection et filtre des coups de cœur de la page d'accueil, plus un badge), écrite par `src/pages/admin/Prestataires.tsx`, et exposée par la vue publique et deux migrations de vue. Ordre recommandé : basculer d'abord la page d'accueil sur `est_premium`, retirer ensuite le champ admin, retirer la colonne de la vue en dernier (DROP CASCADE + recréation).

**Q4** — Zéro test sur les trois fonctions Stripe. Un seul fichier de test Deno existe dans tout le projet (`sign-charte/index_test.ts`). La matrice upgrade/downgrade n'est donc couverte par rien : validation manuelle via Stripe CLI en mode test, ou extension de `stripe-webhook-simulate` en harnais de test authentifié.

**Q5** — Consommateurs de `plan` : `stripe-webhook` (écriture), `stripe-create-checkout` (écriture de `plan_pending`), `stripe-webhook-simulate`, et le front `src/pages/prestataire/Abonnement.tsx` qui traduit `plan` et `plan_pending` en libellé, montant et bandeau de changement programmé. Aucune RPC ni vue ne dépend de `plan`. Recommandation : écriture double pendant la transition, car le front lit `plan` à plusieurs endroits et la migration du front est un lot distinct.

**Q6** — Oui, `est_premium` est dans la signature. 7 fiches actives changeront de valeur, ce qui invalidera leurs snapshots de fiche **et** ceux de chaque page de catégorie/région les listant — sur 122 entrées de file au total, l'impact est significatif mais non massif. Aucune purge : la file marque les entrées à re-rendre, elle ne supprime pas les snapshots existants, qui restent servis jusqu'au nouveau rendu. Prévoir simplement le passage nocturne, pas de garde-fou spécifique.

**Q7** — Le projet stocke aujourd'hui tout identifiant Stripe en secrets d'environnement, sans table de configuration. Avec 4 à 5 prix, rester en secrets via un module `_shared/stripe-config.ts` typé reste le plus simple et évite un aller-retour base à chaque webhook. Une table ne se justifierait qu'avec une grille tarifaire évolutive gérée par l'admin.

**Q8** — Les 3 231 essais n'ont **ni client ni abonnement Stripe** (0 `stripe_customer_id`), et 3 230 n'ont **aucune date de fin d'essai** ; une seule ligne porte `fin_essai_le = 2026-12-01`. Il n'existe aucun mécanisme automatique de fin d'essai : `fin_essai_le` n'est posé que par `trg_set_fin_essai_migration` à l'activation du compte migré, et n'est consommé qu'au moment du Checkout (`trial_end`). Rien ne dégrade un essai expiré. C'est le principal angle mort du plan : la conversion de fin d'essai est à concevoir, indépendamment de la refonte de schéma.

**Q9** — L'ordre a/b/c/d est bon, avec deux ajustements : le nettoyage des 7 fiches et de `fin_premium` doit précéder l'activation du trigger, et la suppression du champ admin doit suivre la bascule de la page d'accueil.

---

## Ordre de déploiement recommandé
1. Créer les prix Stripe (Premium mensuel, Premium annuel, Standard annuel explicite) et les secrets correspondants, sans les exposer côté produit.
2. Ajouter `formule` et `periodicite` avec valeurs par défaut, migrer les 4 lignes payantes, laisser `plan` intact.
3. Centraliser la configuration Stripe dans `_shared/stripe-config.ts`, supprimer `stripe-webhook-simulate` non authentifié, refondre la matrice upgrade/downgrade en écriture double (`plan` + nouvelles colonnes). Validation manuelle via Stripe CLI.
4. Migrer le front `Abonnement.tsx` pour lire `formule`/`periodicite` ; basculer la page d'accueil de `fin_premium` vers `est_premium`.
5. Nettoyer les 7 fiches `est_premium` et les 2 `fin_premium`, puis activer le trigger de dérivation avec garde `IS DISTINCT FROM`, et retirer les champs d'édition admin.
6. Ajouter les colonnes Premium à la vue publique et aux trois agrégats de signature de pré-rendu, laisser le passage nocturne régénérer.
7. Une fois stable, cesser d'écrire `plan`, puis le déprécier.
