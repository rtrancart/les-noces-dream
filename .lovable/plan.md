# Test complet de la synchro retour Brevo

Objectif : rejouer de bout en bout les 4 signaux Brevo sur des adresses fictives, vérifier la base et l'état des listes côté Brevo, puis nettoyer intégralement les traces de test.

## Point de blocage à lever

Le webhook exige le secret `BREVO_WEBHOOK_SECRET`. Sa valeur est stockée de façon sécurisée et je ne peux pas la lire. Pour lancer les appels réels, deux options :

- **A (recommandé)** : tu me donnes le feu vert pour définir une valeur de test connue sur ce secret, je joue les tests, puis tu remets ta valeur définitive (à recopier ensuite côté Brevo).
- **B** : tu me communiques la valeur actuelle et je l'utilise telle quelle pour les appels (rien à changer côté Brevo).

Si aucune des deux ne te convient, je me limite aux vérifications sans secret (401, 200 sur payload illisible) et à la lecture directe en base.

## Scénarios testés

1. **Sécurité** : appel sans secret et avec mauvais secret → 401 ; JSON illisible avec bon secret → 200 sans écriture.
2. **unsubscribe** sur un contact « marié » fictif → ligne dans `oppositions_marketing`, retrait des listes `contact_*`, ajout à `desinscrits_marketing`.
3. **spam** et **blocked** → même matérialisation d'opposition, motif distinct.
4. **hard_bounce** → opposition + écriture dans `suppressed_emails` (coupure du transactionnel).
5. **Contact mixte** (email présent comme prestataire et comme demandeur sur 2 catégories) → après opposition, plus aucune liste marketing, uniquement `desinscrits_marketing`.
6. **Idempotence** : même signal rejoué deux fois → une seule ligne d'opposition, pas d'erreur.
7. **Respect de l'opposition par les 3 flux sortants** : réveil de `brevo-sync-contact`, `brevo-sync-prestataire` et `brevo-sync-compteurs` sur l'email opposé → aucun réajout en liste marketing.

## Détails techniques

- Appels réels sur `/functions/v1/brevo-webhook?secret=…` avec les payloads Brevo (`event`, `email`, `ts`).
- Vérifications en base par requêtes de lecture sur `oppositions_marketing`, `suppressed_emails`, `brevo_sync_log`.
- Vérifications côté Brevo via le gateway connecteur (`/contacts/{email}`) pour lire les listes du contact.
- Adresses de test dédiées, préfixe reconnaissable, aucune adresse réelle touchée.

## Nettoyage

- Suppression des contacts de test chez Brevo.
- `oppositions_marketing` est en ajout seul : les lignes de test devront être retirées par une opération d'administration explicite (je te la soumettrai avec la liste exacte des emails concernés).
- Suppression des entrées de test dans `suppressed_emails` et `brevo_sync_log`.

## Livrable

Un compte rendu ligne par ligne : signal envoyé → code HTTP → état en base → listes Brevo avant/après, avec les éventuels écarts.
