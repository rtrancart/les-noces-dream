# Tarifs Premium annuel + secrets Stripe live

## Partie 1 — Nouveaux tarifs Premium annuel

Seuls deux montants changent : Premium annuel normal 1 590 € → **1 548 €**,
Premium annuel promo 960 € → **930 €**. Les six autres montants sont inchangés.

Points où ces montants existent réellement (vérifié) :

1. `src/pages/prestataire/Abonnement.tsx`, carte Premium annuel :
   prix affiché `1 590€` → `1 548€`, équivalent `soit 132,50€ / mois` → `soit 129€ / mois`.
   La mention « 2 mois offerts » devient inexacte (1 548 € = 10,4 mois) : elle sera
   remplacée par « économisez 240 € par an (-13 %) ». La carte Standard annuel garde
   « 2 mois offerts », qui reste exact (948 = 12 × 79).
2. Fonction base de données `get_promo_eligibility` : les deux montants sont écrits
   en dur dans le jsonb retourné. Nouvelle migration qui recrée la fonction à
   l'identique avec `premium_annuel` = 930 (promo) et 1548 (normal).
3. `supabase/functions/_shared/stripe-config.ts` : un commentaire d'en-tête cite
   « 1 590 € ». Mise à jour du commentaire uniquement, aucune logique touchée.

Aucun autre endroit ne contient ces montants : ni bandeau promo, ni page d'accueil,
ni email, ni modèle de facture. Les prix promo affichés dans l'espace prestataire
viennent tous du jsonb de `get_promo_eligibility`, donc ils suivent automatiquement.
Aucun composant ne recalcule un prix mensuel à partir du prix annuel : l'équivalent
mensuel est un texte, il est donc mis à jour à la main (129 €).

Point d'attention à signaler, pas à corriger sans votre accord : les identifiants de
prix Stripe **test** Premium annuel (normal et promo) pointent encore vers les
anciens prix archivés 1 590 € / 960 €. Tant qu'ils ne sont pas remplacés, un test en
mode test facturera l'ancien montant alors que la page affichera le nouveau. Les
deux secrets test concernés seront donc demandés en même temps que les secrets live.

## Partie 2 — Secrets Stripe live et sélection par mode

État actuel vérifié : le module partagé résout déjà les huit identifiants de prix
avec le suffixe `_TEST` ou `_LIVE` selon `STRIPE_MODE`, donc rien à changer côté
prix. En revanche la clé secrète et le secret de webhook sont lus sous des noms
**sans suffixe** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) dans quatre
fonctions : webhook, création de paiement, portail client, annulation de changement
programmé.

Correctif prévu : deux fonctions utilitaires dans le module partagé
(`stripeSecretKey()`, `stripeWebhookSecret()`) qui lisent la variante du mode
courant (`..._TEST` / `..._LIVE`) et retombent sur le nom sans suffixe si la
variante n'existe pas. Les quatre fonctions Stripe passent par ces utilitaires,
puis sont redéployées. Comportement inchangé aujourd'hui : `STRIPE_MODE` reste
`test` et les noms actuels continuent de fonctionner.

Secrets qui vous seront demandés dans la fenêtre de saisie sécurisée :

- 8 identifiants de prix live (4 normaux, 4 promo)
- `STRIPE_SECRET_KEY_LIVE`, `STRIPE_WEBHOOK_SECRET_LIVE`
- `STRIPE_PRICE_PREMIUM_ANNUEL_TEST` et `STRIPE_PRICE_PROMO_PREMIUM_ANNUEL_TEST`
  (mise à jour vers les nouveaux prix test 1 548 € / 930 €)

`STRIPE_MODE` reste sur `test`, aucune bascule n'est faite.

## À préparer côté Stripe avant le passage en réel

Je vérifierai et vous signalerai, sans le faire à votre place :

- webhook live créé et pointé vers la fonction de webhook, avec les mêmes
  événements que le webhook test ;
- portail client configuré en mode live (le mode test et le mode live ont des
  configurations séparées) ;
- anciens prix Premium annuel bien archivés en live, pour éviter toute nouvelle
  souscription à 1 590 €.

## Vérifications

Contrôle de type, tests de configuration Stripe, relecture finale du dépôt pour
confirmer qu'aucune référence à 1 590 / 960 / 132,50 ne subsiste, et lecture du
jsonb renvoyé par `get_promo_eligibility` après migration.
