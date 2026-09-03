# Sécuriser l'envoi en masse des invitations migrées

## Constat (audit, rien modifié)

- `src/lib/admin/bulkValidateInvite.ts` (`runBulkValidateInvite`, l. 246-259) : boucle `for` séquentielle avec `await`, aucun `sleep`, aucun lot, aucun plafond. Le commentaire d'en-tête (l. 6-10) annonce explicitement qu'un scheduler devait remplacer cette couche.
- `src/pages/admin/Prestataires.tsx` (`runBulkAction`, l. 815-832) : envoie l'intégralité de la sélection ; la boîte de confirmation n'affiche qu'un compte. Le `.limit(200)` du chargement de liste est une limite d'affichage, pas une garde d'envoi.
- `invite-prestataire` n'envoie pas lui-même : il délègue à `send-transactional-email`, qui vérifie `suppressed_emails` puis met en file pgmq.
- Le vrai débit de livraison est donc déjà lissé par `process-email-queue` via l'état persistant `email_send_state` (aujourd'hui `batch_size = 10`, `send_delay_ms = 200`), avec priorité aux emails d'authentification et respect des cooldowns `429`.
- Les bounces sont bien captés (`handle-email-suppression` → `suppressed_emails`, bloquant les envois suivants), mais **rien n'est visible au niveau de la fiche prestataire**.

Conclusion : le lissage de livraison existe déjà côté file. Ce qui manque, c'est (1) un plafond au déclenchement, (2) une cadence maîtrisée d'alimentation de la file, (3) la visibilité des rejets sur les fiches.

## Approche recommandée : renforcer l'existant, pas de nouvelle infrastructure

Pas de nouvelle table de campagne ni de worker dédié : la file pgmq + `email_send_state` font déjà le travail de débit. On ajoute trois garde-fous proportionnés à un envoi ponctuel.

### 1. Plafond de sécurité par exécution

- Constante `BULK_MAX_PER_RUN = 200` dans `bulkValidateInvite.ts`.
- Au-delà, l'exécution est **refusée explicitement** (erreur claire : « sélection de X fiches — maximum 200 par lancement, procédez par lots »), pas tronquée silencieusement.
- La boîte de confirmation affiche le volume et rappelle le plafond ; le bouton « Lancer » est désactivé au-delà.

### 2. Lissage à l'alimentation de la file

- Traitement par sous-lots dans `runBulkValidateInvite` : `BULK_CHUNK_SIZE = 10` fiches, puis pause `BULK_CHUNK_DELAY_MS = 3000` entre sous-lots (ordre séquentiel conservé à l'intérieur).
- Un run plein (200 fiches) s'étale ainsi sur ~1 min d'alimentation, la livraison réelle restant cadencée par `email_send_state`.
- Pour la campagne, la cadence de livraison se règle **sans code** en abaissant `batch_size` / augmentant `send_delay_ms` dans `email_send_state` — je documenterai les valeurs recommandées pour le jour J.
- La barre de progression existante continue de refléter l'avancement ; annulation possible entre deux sous-lots (le run s'arrête proprement et le rapport porte sur les fiches déjà traitées).

### 3. Remontée des rejets sur la fiche

- Aucune colonne ajoutée : `suppressed_emails` est déjà la source de vérité, on la **lit** dans l'admin.
- Liste `/admin/prestataires` : les emails supprimés sont chargés une fois et un badge « Email rejeté » s'affiche sur les fiches dont `email_contact` y figure (avec le motif : bounce / plainte / désinscription).
- Ces fiches deviennent **inéligibles** à l'action groupée (nouveau motif `email_supprime`, visible dans la section « ignorées » du rapport) : on ne re-sollicite plus une adresse morte.
- Un filtre « Email rejeté » permet d'isoler ces fiches pour correction manuelle.

## Ce qui ne change pas

- Un seul geste admin : sélection → « Valider & inviter ».
- Règles de validation, RPC `valider_prestataire_migre`, exemption de charte 90 j, TTL d'invitation 60 j, chemin d'email : inchangés.
- `process-email-queue`, `send-transactional-email`, `handle-email-suppression` : inchangés.

## Limites assumées

- Le lissage vit dans l'onglet admin : fermer l'onglet interrompt le run en cours (les fiches déjà traitées le restent, le rapport partiel s'affiche). Acceptable pour un run de ~1 min ; c'est le prix à payer pour éviter un scheduler serveur sur un besoin ponctuel.
- Le parc migré (~3 230 fiches) demandera donc ~17 lancements de 200. C'est délibéré : cela donne un point de contrôle régulier sur les taux de rejet avant de poursuivre.
- La détection de rejet dépend du webhook Mailgun : un bounce n'apparaît sur la fiche qu'après réception de l'événement (quelques secondes à quelques minutes).
- Aucun quota journalier global n'est instauré : le plafond est par exécution, pas par jour.

## Détails techniques

- `src/lib/admin/bulkValidateInvite.ts` : constantes de plafond/lot/délai, `sleep` entre sous-lots, `BulkIneligibilityReason` étendu à `email_supprime`, `getIneligibilityReason` prend en paramètre optionnel l'ensemble des emails supprimés, garde de plafond en tête de `runBulkValidateInvite`, signal d'annulation optionnel.
- `src/pages/admin/Prestataires.tsx` : chargement des `suppressed_emails` (select `email, reason`), badge et filtre, passage de l'ensemble aux helpers d'éligibilité, mention du plafond dans la confirmation, bouton d'annulation pendant le run.
- Aucune migration de base, aucune Edge Function modifiée, aucun déploiement backend.
