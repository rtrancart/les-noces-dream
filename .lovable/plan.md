# Offre de lancement : souscription immédiate et tarif remisé 12 mois

Objectif : l'abonnement démarre et est facturé dès la souscription (plus d'attente de la fin de l'essai), et tout prestataire qui souscrit pendant sa période d'essai, jusqu'au 31 décembre, bénéficie d'un tarif remisé pendant 12 mois, puis bascule automatiquement au tarif normal.

## Décisions retenues
- Facturation immédiate à la souscription, dans tous les cas. L'essai restant est abandonné au moment où le prestataire souscrit.
- Remise sur les quatre formules (Standard et Premium, mensuel et annuel). Standard mensuel : 49 € au lieu de 89 €.
- Durée de la remise : 12 mois. Ensuite, passage automatique au tarif normal sans action du prestataire.
- Éligibilité : être encore en période d'essai au moment de la souscription, et souscrire au plus tard le 31 décembre.

## À fournir avant la mise en œuvre
1. Les trois autres montants remisés : Standard annuel, Premium mensuel, Premium annuel.
2. Quatre nouveaux prix créés dans Stripe (en test) pour ces montants — sur le même produit que les prix actuels, c'est le plus simple. Je demanderai les quatre identifiants via la fenêtre de saisie sécurisée.

## Comment la remise sur 12 mois est appliquée
Plutôt qu'un code promo, la souscription remisée est créée comme un abonnement en deux temps côté Stripe :
- phase 1 : le prix remisé, pendant 12 mois (12 échéances en mensuel, 1 échéance en annuel) ;
- phase 2 : le prix normal de la même formule, en continu.

Avantage : les montants sont exacts, la bascule est automatique et visible d'avance dans Stripe, et cela réutilise le mécanisme de planification déjà en place pour les changements de formule.

## Étapes

### 1. Configuration
Ajout dans `supabase/functions/_shared/stripe-config.ts` des quatre prix remisés (suffixes `_TEST` / `_LIVE`), d'une fonction qui donne le prix promo d'une formule, et de la date de fin de l'offre (31 décembre).

### 2. Souscription
Dans `stripe-create-checkout` :
- suppression de l'envoi de `trial_end` : la première facture est émise le jour de la souscription ;
- calcul de l'éligibilité promo côté serveur uniquement (essai en cours + date du jour avant la fin de l'offre) ;
- si éligible, la session Checkout crée un abonnement planifié : 12 mois au prix remisé puis retour au prix normal ; sinon, comportement actuel au prix normal.

### 3. Enregistrement en base
Le webhook Stripe reconnaît aussi les prix remisés comme appartenant à leur formule et périodicité, pour que le compte affiche bien « Standard mensuel » et le montant réellement payé. Ajout de deux informations sur l'abonnement : tarif promo en cours et date de fin de la remise.

### 4. Page Abonnement
- Affichage du tarif remisé barré/mis en avant sur les quatre cartes tant que le prestataire est éligible, avec la mention « pendant 12 mois, puis tarif normal » et la date limite du 31 décembre.
- Un bandeau incitatif pendant l'essai : souscrire maintenant pour bénéficier de l'offre.
- Une fois abonné au tarif remisé : rappel de la date de retour au tarif normal.
- Précision claire avant confirmation : la souscription met fin à l'essai et déclenche le paiement immédiat.

### 5. Changements de formule pendant la remise
Un prestataire remisé qui change de formule reçoit le prix remisé de la nouvelle formule pour la durée restante des 12 mois, puis le tarif normal. Les règles actuelles (immédiat facturé vs programmé en fin de période) restent inchangées.

## Détails techniques
- Nouveaux secrets : `STRIPE_PRICE_PROMO_{STANDARD|PREMIUM}_{MENSUEL|ANNUEL}_{TEST|LIVE}`.
- Éligibilité jamais décidée par le navigateur : recalculée dans la fonction serveur avant création de la session.
- Migration : deux colonnes sur `abonnements` (`promo_active`, `promo_fin_le`), alimentées par le webhook.
- Suppression du simulateur de webhook restant du lot précédent laissée hors périmètre.

## Hors périmètre
Aucune nouvelle fonctionnalité Premium, aucune limitation d'accès, aucun passage en environnement réel : tout est validé en test avant bascule.
