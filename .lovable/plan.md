# Sélection multiple et action groupée sur la liste des prestataires

Objectif : ajouter, sur l'écran back-office d'administration des fiches prestataires, la sélection multiple et une action groupée « Valider & inviter » réservée à la revue par lots des fiches importées. Aucune règle métier n'est modifiée : on ne fait que déclencher, pour chaque fiche cochée, les deux chemins existants (validation manuelle + invitation longue durée réservée aux fiches d'origine `migration`).

## 1. Sélection multiple dans la liste

- **Case par ligne** : nouvelle première colonne du tableau avec une case à cocher par fiche. Case désactivée avec info-bulle si la fiche n'est pas éligible à l'action groupée (voir §3 pour les critères).
- **Case « tout sélectionner »** dans l'entête du tableau : coche/décoche uniquement les fiches éligibles de la page courante (respect des filtres statut/catégorie/région/recherche déjà en place). État indéterminé si sélection partielle.
- **État de sélection** : `Set<string>` d'IDs stocké dans le composant `Prestataires.tsx`. Réinitialisé quand les filtres changent (pour éviter d'agir sur des fiches invisibles).
- **Persistance visuelle** : ligne sélectionnée légèrement teintée. Aucun changement au reste du tableau, aux filtres, ni au formulaire d'édition.

## 2. Barre d'actions groupées

- Apparaît en haut du tableau dès qu'au moins une fiche est sélectionnée. Sticky sous les filtres.
- Affiche : « N fiche(s) sélectionnée(s) », un bouton **Valider & inviter**, un bouton **Tout désélectionner**.
- Le bouton principal ouvre une confirmation modale rappelant les deux effets (validation + invitation longue durée 60 j) et le nombre exact de fiches concernées. Rappelle également que l'invitation n'est envoyée qu'aux fiches d'origine `migration` avec un email de contact valide.
- Pendant l'exécution : bouton en état chargement, progression « X / N traitées ».

## 3. Éligibilité par fiche (évaluée côté client avant lancement)

Une fiche est **cochable** si toutes ces conditions sont vraies :

- `email_contact` renseigné et non vide.
- Statut actuel ∈ statuts sélectionnables (exclut `actif` — déjà validée — et `archive`).
- `origine = 'migration'` (contrainte du chemin d'invitation longue durée existant ; les autres fiches doivent passer par la validation individuelle classique).

Les fiches non éligibles restent visibles mais leur case est désactivée avec une info-bulle expliquant la raison.

## 4. Structure : intention vs mécanique d'envoi

Un nouveau module `src/lib/admin/bulkValidateInvite.ts` sépare clairement les deux couches :

```text
UI (Prestataires.tsx)
  └─ appelle runBulkValidateInvite({ ids, onProgress })
       ├─ Étape « intention » : pour chaque id, produit un ordre
       │      { prestataireId, actions: ['validate', 'invite'] }
       │
       └─ Étape « exécution » : dispatcher qui, aujourd'hui,
              exécute les ordres séquentiellement en direct.
              Interface prête à être remplacée plus tard par un
              scheduler (file d'attente / lissage temporel) sans
              rien changer à l'UI ni au producteur d'ordres.
```

Concrètement :

- `buildBulkIntents(ids)` — pur, retourne la liste des intentions par fiche.
- `executeIntent(intent)` — exécute **une** intention en réutilisant strictement les chemins existants :
  1. **Validation** : réplique exactement ce que fait `updateStatut(id, 'validee')` déjà présent dans `Prestataires.tsx` (update `statut = 'validee'` + `logAdmin` + email `validation_publication_fiche` déclenché quand le trigger DB flip vers `actif`). Aucun nouveau chemin d'écriture. Le passage à `actif` reste conditionné par le trigger DB (charte signée / exemption).
  2. **Invitation** : appel à l'edge function existante `invite-prestataire` avec `long_ttl: true` et les champs de la fiche (identique à `handleSendInvitation({ longTtl: true })`). Le garde-fou serveur `origine = 'migration'` reste souverain.
- `runBulkValidateInvite` orchestre : boucle sur les intentions, capture succès/échec par fiche, appelle `onProgress` après chaque item.

**Pourquoi cette découpe** : quand viendra le lissage d'envoi, on remplacera uniquement `executeIntent` (ou son dispatcher) par un enqueue vers une table de campagne + worker. `buildBulkIntents` et l'UI resteront inchangés.

## 5. Compte-rendu par fiche

À la fin du traitement, une modale récapitulative liste **chaque fiche traitée** avec :

- ✓ Nom commercial — succès (validation + invitation)
- ⚠ Nom commercial — validation OK, invitation échouée : *message d'erreur*
- ✗ Nom commercial — validation échouée : *message d'erreur* (invitation non tentée)
- ⊘ Nom commercial — ignorée (non éligible) : *raison*

Chaque ligne indique l'action effectivement réalisée et le message d'erreur brut renvoyé par le chemin sous-jacent. Un bouton « Copier le rapport » exporte la liste au presse-papiers en texte. Un `logAdmin("bulk_validate_invite", ...)` synthétise les compteurs (total, succès, erreurs) en fin de run.

Politique en cas d'échec partiel : les fiches suivantes continuent d'être traitées. Aucune fiche n'est ignorée silencieusement.

## 6. Onglet Photos — état actuel et complément proposé

**État actuel** (`PrestatairePhotosTab.tsx`) : upload multi-fichiers dans le bucket `prestataires-photos`, affichage combiné `photo_url` (principale) + `galerie_urls`, définition d'une photo principale, suppression individuelle. Limite 5 Mo par image, filtrage type MIME.

**Complément suggéré, à confirmer** : pour la revue par lots, la seule action régulièrement utile mais absente est le **réordonnancement** des photos de la galerie (drag-and-drop) et un **avertissement visuel** quand une fiche importée n'a aucune photo ou seulement la photo principale — utile pour repérer les fiches à compléter avant validation.

Je ne toucherai à l'onglet Photos que si vous confirmez ce périmètre ; il n'est pas bloquant pour la sélection multiple.

## 7. Hors périmètre (rappel)

- Aucune modification de `updateStatut`, du trigger DB `validee → actif`, du mécanisme d'exemption de charte.
- Aucune modification des edge functions `invite-prestataire` / `resend-magic-link`.
- Aucun import de données, aucune refonte des filtres ni du formulaire d'édition.
- Le lissage temporel des envois est explicitement reporté à une étape ultérieure : la découpe intention/exécution du §4 rend ce futur ajout non intrusif.

## 8. Fichiers touchés

- `src/pages/admin/Prestataires.tsx` : nouvelle colonne case à cocher, entête « tout sélectionner », barre d'actions groupée, modale de confirmation, modale de rapport.
- `src/lib/admin/bulkValidateInvite.ts` (nouveau) : `buildBulkIntents`, `executeIntent`, `runBulkValidateInvite`, types du rapport.

Aucun changement backend, aucun changement de schéma.
