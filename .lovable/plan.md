# P2 — Refonte Stripe : 4 prix, matrice de changement, configuration centralisée

Périmètre : uniquement la mécanique d'abonnement (configuration, webhook, création de checkout, appel depuis l'espace pro). Aucune nouvelle fonctionnalité Premium, aucune nouvelle grille tarifaire visible, aucune limitation, aucun prix en environnement réel.

## Préalables à fournir (secrets)
Avant l'étape 1, cinq valeurs sont nécessaires : le mode (`test`) et les quatre identifiants de prix créés dans Stripe en test — Standard mensuel 89 €, Standard annuel 948 €, Premium mensuel 149 €, Premium annuel 1 609 €. Je les demanderai via la fenêtre de saisie sécurisée dès l'approbation.

## Étape 1 — Module de configuration partagé
Création de `supabase/functions/_shared/stripe-config.ts` : lecture du mode, table des quatre identifiants de prix (suffixe `_TEST` ou `_LIVE`), et trois utilitaires — `priceIdToPlan`, `planToPriceId`, `computeChangeType`.

Matrice de `computeChangeType` :
- formule différente, standard → premium : `upgrade_immediate`, proration facturée
- formule différente, premium → standard : `downgrade_scheduled`, sans proration
- formule identique, mensuel → annuel : `periodicite_immediate`, proration facturée
- formule identique, annuel → mensuel : `periodicite_scheduled`, sans proration
- identique des deux côtés : `noop`

Test unitaire des 16 combinaisons (Vitest, fichier `supabase/functions/_shared/stripe-config.test.ts`). Aucun autre fichier touché à cette étape.

## Étape 2 — Webhook Stripe
`stripe-webhook/index.ts` : suppression de la correspondance en dur et de `planFromPriceId`, import du module partagé. À chaque synchronisation d'abonnement, l'identifiant de prix de la souscription donne formule + périodicité, qui sont écrites dans les nouvelles colonnes, plus l'ancienne colonne `plan` (double écriture transitoire). Les flux impayés, pauses et moyens de paiement restent strictement inchangés.

**Décision sur l'ancienne colonne `plan`** : ajout de deux valeurs manquantes à la liste autorisée, `standard_annuel` et `premium_annuel`, via une migration de base. C'est plus propre que de réutiliser `annuel`, qui ne dit pas la formule. La valeur `annuel` reste acceptée pour l'historique. Correspondance retenue : standard/mensuel → `standard_mensuel`, standard/annuel → `standard_annuel`, premium/mensuel → `premium_mensuel`, premium/annuel → `premium_annuel`.

## Étape 3 — Création de checkout et changement de formule
`stripe-create-checkout/index.ts` : l'entrée devient deux paramètres, formule et périodicité (l'ancien paramètre unique reste accepté un temps pour ne rien casser). Suppression des rangs 1/2/3.
- Aucun abonnement en cours : session Checkout classique sur le prix résolu.
- Abonnement en cours : décision par `computeChangeType`. Immédiat → mise à jour de la souscription avec facturation de la proration et `error_if_incomplete`. Programmé → planification Stripe en fin de période, avec écriture de `plan_pending`, `plan_pending_le` et de l'identifiant de planification.
- Impayé en cours : refus avec message clair (comportement actuel conservé).
- Reclic sur la formule courante alors qu'un changement est programmé : annulation de ce changement (logique existante adaptée à la nouvelle matrice).

## Étape 4 — Suppression du simulateur
Suppression complète de `supabase/functions/stripe-webhook-simulate` (déployé sans authentification) et vérification qu'aucune référence ne subsiste dans le code.

## Étape 5 — Espace pro (appel uniquement)
`src/pages/prestataire/Abonnement.tsx` : lecture des colonnes formule et périodicité en plus de l'ancienne, priorité aux nouvelles pour le libellé, et envoi des deux paramètres lors d'un changement. Aucun changement visuel, la grille à quatre formules reste pour un lot ultérieur.

## Rapport final
Synthèse par étape, fichiers créés / modifiés / supprimés, secrets créés et secrets devenus obsolètes à retirer (`STRIPE_PRICE_STANDARD`, `STRIPE_PRICE_PREMIUM`, `STRIPE_PRICE_ANNUEL`), décision sur l'ancienne colonne `plan`, procédure de test manuel via l'outil en ligne de commande Stripe pour les six scénarios demandés, et signalement de tout écart.

## Points hors périmètre confirmés
Pas de colonnes vidéos / réseaux sociaux / statistiques avancées, pas de modification de la vue publique, aucune limitation, pas de nouvelle grille tarifaire, pas de prix en environnement réel.
