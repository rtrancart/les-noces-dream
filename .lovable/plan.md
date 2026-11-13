# Brevo : ne plus envoyer de marketing aux adresses en échec (bounce / plainte)

## Constat
- 130 prestataires actifs ont une adresse en échec (bounce) ou une plainte enregistrée par l'application, mais Brevo continue de les recevoir chaque nuit dans la liste marketing « prestataires » avec le consentement marketing actif.
- Les synchros vers Brevo (en temps réel et la nuit) ne regardent que les oppositions marketing. Elles ignorent les adresses bloquées par l'application.
- Les bounces qui arrivent par Brevo sont déjà bien traités. On n'y touche pas.

## Ce qui change
1. **Règle commune** : une adresse qui a eu un bounce ou une plainte compte comme une opposition marketing. Les désinscriptions des emails de l'application (« unsubscribe ») ne sont pas concernées : elles portent sur les emails de service, pas sur le marketing.
2. **Synchro en temps réel** (une fiche est modifiée) : ces contacts partent dans la liste technique « desinscrits_marketing », avec le consentement marketing à faux. Ils ne vont jamais dans la liste « prestataires ».
3. **Synchro de nuit** (compteurs) : même règle.
4. **Nouveaux bounces** : quand l'application enregistre un nouveau bounce ou une nouvelle plainte, le contact Brevo est mis à jour au prochain passage de nuit au plus tard.
5. **Rattrapage unique** : une fois les synchros corrigées, on relance la synchro des 130 prestataires concernés. On vérifie ensuite dans Brevo qu'ils sont dans « desinscrits_marketing » et plus dans « prestataires ».

## Non concerné
- Aucun email n'est envoyé. Le contact reste dans Brevo, ce qui permet de garder ses compteurs et son historique.
- Les fiches, leurs statuts et les emails de service de l'application ne changent pas.

## Vérifications
- Un test automatique : bounce = opposition, plainte = opposition, désinscription d'un email de service ≠ opposition marketing.
- Contrôle des listes Brevo pour 3 prestataires concernés et 1 non concerné, puis comptage des 130 contacts à la fin.

## Détails techniques
- `_shared/brevo-opposition.ts` : `estOppose` interroge aussi `suppressed_emails` (reason in 'bounce','complaint'), avec email normalisé en minuscules.
- `brevo_compteurs_prestataires` (SQL) : même condition ajoutée au calcul de l'opposition (migration additive, `CREATE OR REPLACE`).
- Rattrapage : appel de `brevo-sync-prestataire` par lots lents pour les 130 identifiants, résultats lus dans `brevo_sync_log`.
- Redéploiement de `brevo-sync-prestataire` et `brevo-sync-compteurs`. Mise à jour de la mémoire « Brevo Synchro Retour ».
