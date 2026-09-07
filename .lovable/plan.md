# Correction — Bug de version d'API Stripe sur `current_period_*` dans `stripe-webhook`

Périmètre : uniquement `supabase/functions/stripe-webhook/index.ts`. Aucun autre fichier, aucun changement de version d'API Stripe, aucune modification de la logique métier (statuts, plans, impayés, schedules).

## Diagnostic confirmé

Dans `syncSubscription` (lignes 423-425), les champs `current_period_end`, `current_period_start` et `trial_end` sont lus à la racine de l'objet `Stripe.Subscription`. Cela fonctionne avec la version d'API 2024-11-20 du SDK, mais Stripe Basil (2025-xx) a déplacé `current_period_end` et `current_period_start` dans `subscription.items.data[0]`. Les événements natifs `customer.subscription.created` et `customer.subscription.updated` utilisent le payload brut du compte, d'où le `RangeError: Invalid time value` observé.

## Étapes de correction

### Étape 1 — Ajouter deux utilitaires locaux

Dans `supabase/functions/stripe-webhook/index.ts`, ajouter en bas de la section des helpers (avant `syncSubscription`) :

- `getPeriodEnd(sub: Stripe.Subscription): number | undefined`
- `getPeriodStart(sub: Stripe.Subscription): number | undefined`

Chaque fonction tente dans l'ordre :
1. La valeur à la racine (`sub.current_period_end` / `sub.current_period_start`).
2. La valeur sur le premier item (`sub.items.data[0]?.current_period_end` / `sub.items.data[0]?.current_period_start`).
3. Si les deux sont indéfinis : émettre un `console.warn` indiquant que la période n'a pas pu être résolue et qu'il faut investiguer un éventuel nouveau changement d'API Stripe.

### Étape 2 — Remplacer les lectures directes dans `syncSubscription`

Remplacer :
- `sub.current_period_end` par `getPeriodEnd(sub)`
- `sub.current_period_start` par `getPeriodStart(sub)`

Conserver `sub.start_date` et `sub.trial_end` à la racine (ils n'ont pas bougé d'API), mais vérifier visuellement qu'ils sont bien définis avant conversion. Si `getPeriodEnd` ou `getPeriodStart` retourne `undefined`, laisser le champ correspondant (`fin_periode_le` / `debut_le`) inchangé lors d'un UPDATE, ou `null` lors d'un INSERT, plutôt que de planter sur `new Date(undefined * 1000)`.

### Étape 3 — Vérifier les autres champs de date du fichier

Parcourir l'ensemble de `stripe-webhook/index.ts` et s'assurer qu'aucun autre timestamp Stripe n'est lu de manière fragile. Les champs suivants sont utilisés et restent à la racine dans les deux versions d'API connues ; aucun fallback n'est nécessaire, mais la vérification est incluse dans le périmètre :
- `sub.start_date` (ligne 424)
- `sub.trial_end` (ligne 425)
- `sub.cancel_at_period_end` (lignes 410, 422, 431)
- `invoice.payment_succeeded` : `sub.current_period_end` (ligne 116) → remplacer également par `getPeriodEnd(sub)`.

### Étape 4 — Déploiement et validation

1. Déployer la fonction `stripe-webhook` via `supabase--deploy_edge_functions`.
2. Surveiller les logs Edge Function sur les événements récents pour confirmer la disparition de `RangeError: Invalid time value`.
3. Si des événements `customer.subscription.*` ont échoué récemment, les rejouer depuis Stripe Dashboard (bouton **Resend** dans Recent deliveries) et vérifier qu'ils passent.

## Hors périmètre

- Pas de montée de version du SDK Stripe (`npm:stripe@17` et `apiVersion: 2024-11-20.acacia` restent en place).
- Pas de modification de `stripe-create-checkout`, `stripe-webhook-simulate`, ni de l'espace pro.
- Pas de migration base de données.
