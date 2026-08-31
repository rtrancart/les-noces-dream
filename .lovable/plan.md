# Audit — règle de gratuité des prestataires migrés

Audit seul, aucune modification prévue.

## Ce qui a été appliqué

À l'import du 22/07/2026, un abonnement a été créé pour chacune des 3 230 fiches `origine = migration` :

- `plan = essai`, `statut = trialing`
- `fin_essai_le = NOW() + 90 jours`, soit **20/10/2026 pour tout le parc** (date identique sur les 3 230 lignes, vérifiée en base)
- aucun lien Stripe : `stripe_customer_id` et `stripe_subscription_id` sont vides sur 100 % des lignes, donc aucune carte enregistrée et aucun prélèvement possible tant que le prestataire n'a pas souscrit lui-même

## Comment cette date est honorée au paiement

Quand un migré souscrit, `stripe-create-checkout` relit `fin_essai_le` et le transmet à Stripe en `trial_end` s'il est encore dans le futur. Conséquence : la carte est enregistrée immédiatement, mais le premier prélèvement est repoussé au 20/10/2026. Après cette date, la souscription est facturée dès la validation du paiement.

## Point de vigilance

La gratuité est calée sur une **date fixe commune**, pas sur la date d'invitation, de validation ou d'activation du compte. Le parc étant encore majoritairement en `en_attente`, une fiche validée en septembre n'aura qu'environ 4 à 6 semaines de gratuité réelle au lieu de 90 jours, et une fiche validée après le 20/10 n'en aura aucune.

## À ne pas confondre : l'exemption de charte

`charte_exemptee_jusqua` est aussi une fenêtre de 90 jours, mais elle est posée **au moment de la validation** de chaque fiche (action groupée « Valider & inviter »), donc individualisée. Elle conditionne la visibilité de la fiche, pas la facturation. Les deux compteurs de 90 jours ne sont donc pas alignés.

## Options si la règle doit évoluer (non engagées)

1. Statu quo : fin d'essai commune au 20/10/2026.
2. Recalage individuel : 90 jours à partir de l'activation du compte ou de la validation de la fiche.
3. Décalage global : repousser la date unique pour tout le parc.
