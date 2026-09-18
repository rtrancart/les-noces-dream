# Rattrapage post-panne et garde-fou anti-panne silencieuse

## 1. Rattrapage des crons datés — Étape A (constat, aucun envoi)

Vérification faite en lecture seule sur la base. Résultat : **aucun destinataire n'a été perdu** par les trois tâches concernées.

| Tâche | Destinataires en attente aujourd'hui | Explication |
| --- | --- | --- |
| Relance impayé J+7 | 0 | Aucun abonnement en retard de paiement avec un premier échec daté : il n'y avait personne à relancer, ni le 16, ni depuis. |
| Relance migration M-05 (charte) | 0 | Les 7 seules fiches concernées ont reçu leur message les 13, 14 et 15 septembre, avant la panne (envois confirmés dans le journal d'emails). Aucune nouvelle fiche n'est devenue éligible depuis. |
| Fin d'exemption de charte | 0 | Aucune fiche visible dont l'exemption est arrivée à échéance : les exemptions en cours courent jusqu'au 9 décembre 2026. |

Raison de fond : ces trois tâches recalculent leur liste de destinataires à chaque passage, à partir de l'état en base. Une journée sautée ne perd personne — le destinataire est simplement traité au passage suivant. Les tâches ont d'ailleurs repris normalement ce matin (appels en 200 depuis 10h04).

**Étape B : sans objet.** Il n'y a rien à rejouer. Si tu veux malgré tout une preuve d'exécution, je peux déclencher un passage manuel des trois tâches : leur liste étant vide, elles se termineront sans aucun envoi.

## 2. Relance des tâches nocturnes ratées

- **Pré-rendu** : les 540 pages sont figées au 16 septembre 03h16. Je relance une fois le cycle complet (recensement des pages + génération des snapshots modifiés), puis je confirme le nombre de pages rafraîchies et l'absence de page en échec.
- **Compteurs Brevo** : je relance une fois le batch nocturne (vues, demandes, favoris, taux de réponse, note) et je confirme le nombre de prestataires mis à jour et le statut de fin.

Les deux sont relancés en mode normal, sans forçage : les pages inchangées ne sont pas régénérées inutilement.

## 3. Garde-fou anti-panne silencieuse

Principe retenu : une seule surveillance horaire en base, qui regarde trois symptômes et envoie **un** email à rodolphe@lesnoces.net, avec un anti-spam d'une alerte par symptôme toutes les 24 h.

Déclencheurs :
1. Un appel de tâche planifiée renvoie une réponse « non autorisé » (401) dans la dernière heure — c'est exactement le symptôme de l'incident, détecté en moins de 60 minutes au lieu de 2 jours.
2. Un événement de synchronisation reste « à rejouer » plus de **2 heures** (seuil proposé : la reprise tourne tous les quarts d'heure, donc 2 h signifie 8 échecs consécutifs, sans fausse alerte sur un incident réseau passager).
3. Les snapshots de pré-rendu n'ont pas été rafraîchis depuis plus de 30 heures (filet pour toute tâche nocturne muette).

Contenu de l'email : le symptôme, le nombre d'éléments concernés, l'heure de première détection, et le lien vers la page de suivi des emails de l'administration.

### Détails techniques

- Nouvelle Edge Function `cron-monitoring-alertes` (`verify_jwt = false`) :
  - lit `net._http_response` (401 sur la dernière heure), `brevo_sync_log` (statut d'échec avec `updated_at` > 2 h et tentatives ≥ 1), et `max(rendu_le)` de `prerender_queue` ;
  - pour chaque symptôme actif, tente un verrou en base avant envoi (anti-doublon), puis appelle `send-app-email`, et libère le verrou si l'envoi échoue — même schéma que les crons corrigés hier ;
  - retourne un JSON `{ ok, symptomes, envoyes }` pour diagnostic manuel.
- Migration : table `monitoring_alertes` (`cle` texte unique, `dernier_envoi_le`, `details` jsonb), RLS activée, `GRANT` pour `service_role` uniquement (aucun accès `anon`/`authenticated`), plus `cron.schedule('monitoring-alertes-horaire', '5 * * * *', ...)` appelant la fonction via `pg_net` avec le secret Vault `email_queue_service_role_key`.
- Nouveau template transactionnel `alerte_technique_admin` (destinataire fixe rodolphe@lesnoces.net) : composant React Email + entrée dans `registry.ts` + ligne dans `email_textes` pour rester éditable depuis `/admin/emails`.
- Observation annexe relevée pendant l'audit : deux appels de reprise ont dépassé le délai de 5 s de `pg_net` (09h30 et 10h00). Sans conséquence — la reprise repasse au quart d'heure suivant — mais le seuil de 2 h évite d'alerter sur ce bruit.

## Hors périmètre

Tableau de bord de supervision, alertes SMS/Slack, surveillance des rebonds email (déjà couverte), modification des horaires des crons existants.
