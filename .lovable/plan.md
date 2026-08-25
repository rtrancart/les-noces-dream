# Brevo — `subscription_started` = entrée dans le tunnel + attribut ORIGINE

## Constat (vérifié dans le code)

- Le champ existe bien : `prestataires.origine` (type `origine_prestataire`) avec 3 valeurs : `inscription_admin`, `auto_inscription`, `migration`. Il est immuable (trigger `prevent_origine_prestataire_modification`).
- **Il n'est pas envoyé à Brevo** : les attributs poussés par `brevo-sync-prestataire` sont `NOM_COMMERCIAL`, `STATUT_FICHE`, `CYCLE_VIE`, `FIN_ESSAI`, `DATE_PREMIERE_PUBLI`, `REGION`, `CONSENTEMENT_MKT`. Aucune trace d'`ORIGINE`, ni dans les propriétés d'événement.
- Aujourd'hui `subscription_started` est déclenché par le trigger sur `abonnements` quand un abonnement passe à `actif` — donc à la **fin** du parcours (paiement), pas à son début.

## Ce que je vais changer

### 1. `subscription_started` = début du tunnel d'inscription
Nouveau déclenchement, sur la fiche prestataire elle-même, une seule fois par fiche :
- **Inscription par l'admin** : au clic sur « Sauvegarder et envoyer l'invitation » — la fiche est créée/mise à jour en `pre_inscrit` avec `magic_link_envoye_le` renseigné. C'est ce moment qui déclenche l'événement.
- **Auto-inscription depuis le site** : à la création de la fiche (`origine = auto_inscription`).
- **Migration du parc** (`origine = migration`) : exclue. Ces 3 293 fiches n'ont pas fait de tunnel d'inscription ; les faire entrer déclencherait un envoi de masse d'événements historiques. Elles entreront dans le tunnel au moment de leur invitation (`magic_link_envoye_le`), ce qui reste couvert par la règle admin ci-dessus.

L'événement reste non rejouable (garde-fou existant : un `kind` d'événement déjà `reussi` dans `brevo_sync_log` n'est jamais renvoyé).

### 2. Le moment « abonnement payé » ne disparaît pas
Le trigger sur `abonnements` cesse d'émettre `subscription_started` (le nom devient impropre) et se contente de la synchro d'état : `CYCLE_VIE` passe de `essai` à `abonne`, `FIN_ESSAI` est mis à jour. C'est cet attribut qui sert de segmentation « client payant » côté Brevo, plus fiable qu'un événement puisqu'il reflète l'état courant.

### 3. Attribut `ORIGINE` poussé à Brevo
- Ajout de `ORIGINE` aux attributs de contact de tout prestataire (valeurs : `inscription_admin`, `auto_inscription`, `migration`), donc présent sur **tous** les flux prestataire (synchro d'état, `fiche_published`, `subscription_started`, batch compteurs par héritage des attributs de contact).
- Ajout de `origine` aux propriétés de l'événement `subscription_started`, avec `statut_fiche` et `region` déjà présents.
- Déclaration de l'attribut dans le provisioning de schéma Brevo en type liste fermée (`category`), comme `CYCLE_VIE` et `STATUT_FICHE`, pour rester segmentable proprement.

## Détails techniques

- Migration SQL : `brevo_prestataire_sync_trigger()` — ajout du déclenchement `subscription_started` sur INSERT (`origine IN ('inscription_admin','auto_inscription')`) et sur UPDATE quand `magic_link_envoye_le` passe de NULL à une date ; `brevo_abonnement_sync_trigger()` — retrait de l'émission `subscription_started`, bascule sur `presta_sync`.
- `supabase/functions/brevo-sync-prestataire/index.ts` : lecture de `origine` dans le SELECT, ajout de `ORIGINE` dans `attributes` et de `origine` dans `event_properties`.
- `supabase/functions/brevo-provision-schema/index.ts` : ajout de `ORIGINE` à la liste des attributs `category` avec ses 3 valeurs, puis relance du provisioning depuis l'onglet Connecteurs.
- Redéploiement des deux Edge Functions. Aucune rétro-émission d'événements sur l'existant.
