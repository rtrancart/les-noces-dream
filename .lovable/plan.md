# Arrêt de l'essai gratuit dès la souscription d'un abonnement

Aujourd'hui, quand un prestataire encore en essai souscrit une formule payante, la souscription reprend la date de fin d'essai en cours : la carte est enregistrée mais le premier prélèvement est repoussé jusqu'à la fin de l'essai (cas Atelier Test Migration, essai jusqu'au 1er décembre 2026). C'est ce comportement qu'on supprime.

## Ce qui change pour le prestataire

- Il choisit une formule, paie immédiatement, et son abonnement démarre le jour même.
- L'essai gratuit restant est perdu — c'est le principe : l'essai sert à essayer avant de payer, pas à cumuler.
- Avant validation, l'écran d'abonnement le dit clairement : « Votre période d'essai prend fin dès la souscription. La facturation démarre aujourd'hui. » Ce message n'apparaît que pour les comptes encore en essai.
- Le compte n'est plus affiché « en essai » après paiement : il passe en actif avec la formule choisie et la prochaine date de facturation.

## Ce qui change côté facturation

1. **Première souscription** : la page de paiement ne reporte plus la fin d'essai. Le paiement est prélevé à la validation.
2. **Changement de formule** pendant un essai en cours (cas rare, uniquement si une souscription payante existe déjà en essai) : l'essai est clôturé immédiatement et la facturation démarre au moment du changement.
3. **Cas déjà en cours** : les abonnements déjà créés en essai reporté ne sont pas modifiés automatiquement. Ils resteront en essai jusqu'à leur date prévue, sauf demande explicite de votre part de les basculer un par un.
4. Le retour d'information de la plateforme de paiement continue de faire foi pour le statut et la date de fin d'essai : rien à changer de ce côté.

## Détails techniques

- `supabase/functions/stripe-create-checkout/index.ts` :
  - Bloc « nouvelle souscription » (~ lignes 279-300) : suppression du calcul `finEssai` / `trialEndSec` et de l'injection `trial_end` dans `subscription_data`. Le Checkout est créé sans essai.
  - Bloc « changement immédiat » (`decision.immediate`) : ajout de `trial_end: "now"` sur `stripe.subscriptions.update` lorsque la souscription cible est encore `trialing`, afin de clore l'essai et déclencher la facturation.
- `supabase/functions/stripe-webhook/index.ts` : inchangé — `fin_essai_le` reste alimenté par `sub.trial_end`, qui vaudra `null` après souscription.
- `src/pages/prestataire/Abonnement.tsx` : bandeau d'avertissement affiché uniquement si l'abonnement courant a le statut `trialing`, au-dessus des cartes de formule et repris dans la confirmation.
- Aucune migration de base, aucun changement de grille tarifaire, aucune modification des formules ni des prix.

## Hors périmètre

Offre promotionnelle pendant l'essai, remboursement au prorata de l'essai perdu, migration rétroactive des abonnements déjà en essai reporté.
