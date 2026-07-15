## Audit runtime de la séquence d'emails d'impayé

Objectif : dérouler un cycle Stripe complet en simulation et vérifier via `email_send_log` et l'état DB que chaque email part exactement une fois, dans le bon ordre, avec les bons marqueurs.

### Prestataire de test
`rodolphe.trancart@gmail.com` (compte super_admin, déjà utilisé pour les tests précédents). Récupération de son `abonnements.id`, `prestataire_id`, `stripe_subscription_id` en début d'audit.

### Scénario déroulé

Utilisation de `stripe-webhook-simulate` (déjà présent dans le projet) ou d'`INSERT` DB + `curl_edge_functions` sur `stripe-webhook` avec des payloads Stripe fabriqués. Le webhook est appelé sans signature valide → basculer temporairement sur `stripe-webhook-simulate` qui court-circuite la vérif de signature.

Étapes chronologiques :

| # | Événement injecté | Vérification DB attendue | Vérification email |
|---|---|---|---|
| 1 | `invoice.payment_failed` #1 | `nb_echecs_paiement = 1`, `premier_echec_le` posé, `statut = en_retard` | 1 ligne `impaye_premier_echec` en `sent` |
| 2 | `invoice.payment_failed` #2 (rejeu Smart Retries) | `nb_echecs_paiement = 2`, `premier_echec_le` inchangé, `rappel_impaye_envoye_le` toujours NULL | **aucun nouvel email** |
| 3 | `invoice.payment_failed` #3 | `nb_echecs_paiement = 3` | aucun nouvel email |
| 4 | Backdate `premier_echec_le = now() - 8j` puis lancer `cron-relance-impaye-j7` | `rappel_impaye_envoye_le` posé | 1 ligne `impaye_rappel_intermediaire` en `sent` |
| 5 | Re-lancer `cron-relance-impaye-j7` immédiatement | `rappel_impaye_envoye_le` inchangé | **aucun nouvel email** (idempotence) |
| 6 | `customer.subscription.deleted` avec `cancellation_details.reason = payment_failed` | `suspendu_pour_impaye_le` posé | 1 ligne `impaye_suspension` en `sent` |
| 7 | `invoice.payment_failed` post-suspension | état inchangé | aucun email (garde `suspendu_pour_impaye_le`) |
| 8 | Restauration : reset des 4 champs à NULL, `nb_echecs_paiement = 0`, `statut = actif` | cycle rouvert | — |
| 9 | Nouveau `invoice.payment_failed` | `premier_echec_le` reposé, `nb_echecs_paiement = 1` | 1 nouvelle ligne `impaye_premier_echec` (nouveau cycle → reparti proprement) |

### Requêtes de contrôle utilisées
- `SELECT nb_echecs_paiement, premier_echec_le, rappel_impaye_envoye_le, suspendu_pour_impaye_le, statut FROM abonnements WHERE prestataire_id = ...`
- `SELECT DISTINCT ON (message_id) template_name, status, created_at, error_message FROM email_send_log WHERE recipient_email = 'rodolphe.trancart@gmail.com' AND template_name LIKE 'impaye_%' ORDER BY message_id, created_at DESC`

### Livrables
- Rapport en fin d'audit : tableau réel observé vs attendu, statut PASS/FAIL par étape, éventuelles anomalies + correctifs proposés.
- Restauration finale de l'état de l'abonnement du compte de test (aucune trace résiduelle).
- Aucun envoi réel d'email vers ta boîte n'est nécessaire côté logique — mais comme les templates sont ré-enqueuedés par `send-transactional-email`, tu recevras probablement 3 à 4 emails de test (identiques à ceux du tour précédent). Dis-moi si tu veux les recevoir ou si je dois supprimer les envois du queue avant traitement.

Confirme-moi que je peux :
1. Utiliser ton compte prestataire comme sujet de test,
2. Injecter les événements via `stripe-webhook-simulate` (ou fabriquer les updates DB si la fonction n'accepte pas tous les cas),
3. T'envoyer réellement les emails ou les intercepter avant envoi.
