# Checklist cutover production — LesNoces.net

À valider avant bascule DNS / passage en mode Live.

## Stripe

- [ ] `STRIPE_SECRET_KEY` remplacée par la clé **live** (sk_live_…).
- [ ] `STRIPE_WEBHOOK_SECRET` remplacé par le secret du **endpoint webhook live**.
- [ ] `STRIPE_PRICE_STANDARD`, `STRIPE_PRICE_PREMIUM`, `STRIPE_PRICE_ANNUEL` pointent vers des prix **live** (pas test).
- [ ] Endpoint webhook live créé dans Stripe et abonné aux mêmes événements que le test : `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.payment_succeeded|failed`, `payment_method.attached|detached`, `customer.updated`, `subscription_schedule.updated|released|canceled`.
- [ ] Smart Retries activé en mode live (Settings → Subscriptions → Manage failed payments).
- [ ] Comportement de fin de retries : **Cancel subscription** avec `cancellation_details.reason = payment_failed` (indispensable pour déclencher `impaye_suspension`).
- [ ] Réglage « annuler l'abonnement à la fin de la période » revérifié côté portail client live.
- [ ] Test end-to-end en live sur un compte pilote : checkout → prélèvement OK → carte invalide → séquence 3 emails.

## Sécurité edge functions

- [ ] **`stripe-webhook-simulate` supprimé** avant cutover DNS. Aucune fonction bypassant la signature Stripe ne doit exister en Live (`supabase functions delete stripe-webhook-simulate`).
- [ ] Revérifier qu'aucune autre edge function ne court-circuite `stripe.webhooks.constructEventAsync`.

## Emails

- [ ] Domaine email vérifié en production.
- [ ] Templates `impaye_premier_echec`, `impaye_rappel_intermediaire`, `impaye_suspension` reçus et rendus correctement (client mail réel).
- [ ] Cron `cron-relance-impaye-j7` planifié quotidiennement en prod.

## Divers

- [ ] `PUBLIC_SITE_URL` = domaine final (pas `les-noces.lovable.app`).
- [ ] `REACTIVATION_TEAM_EMAIL` pointe vers la boîte support live.
