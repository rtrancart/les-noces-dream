## Problème

Le bouton « Soumettre pour validation » dans `src/pages/prestataire/Profil.tsx` n'apparaît jamais pour la fiche TEST Archivé Réactivation (statut `archive`), et ne s'aligne pas avec l'architecture définitive des statuts.

Actuellement :
```ts
const canShowSubmit = prestataire && ["pre_inscrit", "a_corriger"].includes(prestataire.statut);
```

`a_completer` est manquant, et `pre_inscrit` ne devrait plus jamais être visible (transition automatique vers `a_completer` au premier login via `mark_prestataire_first_login`).

## Décision

- Self-service : `a_completer` + `a_corriger` → bouton visible, soumission directe vers `en_attente`.
- `archive` et `suspendu` → pas de bouton côté presta, étape admin obligatoire (réactivation → `a_completer`).

## Changements

### 1. `src/pages/prestataire/Profil.tsx`
- Remplacer la liste éligible :
  ```ts
  const canShowSubmit = prestataire && ["a_completer", "a_corriger"].includes(prestataire.statut);
  ```
- Pas d'autre logique à toucher : `handleSubmitForValidation` écrit déjà `statut = 'en_attente'` via `.update().select()` avec détection d'échec RLS.

### 2. `src/pages/admin/Prestataires.tsx` — workflow réactivation
Vérifier qu'un admin peut faire transiter `archive` ou `suspendu` → `a_completer` depuis le `<Select>` de statuts (déjà autorisé puisque `actif` est le seul statut exclu du Select). Si le cas n'est pas couvert visuellement, ajouter un bouton « Réactiver vers À compléter » dans la fiche admin pour rendre l'action évidente sur les fiches `archive` / `suspendu`.

### 3. Communication UI sur statuts non éligibles
Dans `ProviderInfoBanner.tsx` (déjà chargé de l'affichage du statut), ajouter pour `archive` et `suspendu` un court message indiquant que la réactivation passe par l'équipe (avec un mailto ou un lien vers le formulaire de réactivation déjà existant `/reactivation` selon ce qui est en place).

## Hors scope

- Pas de changement DB / triggers (l'invariant `actif` reste géré par les triggers).
- Pas de changement Edge Functions.
- Pas de changement sur `pre_inscrit` (transition auto au premier login déjà en place).

## Vérification

- Connecté en tant que presta `a_completer` : encart de soumission visible, bouton actif/inactif selon `missingFields`.
- Connecté en tant que presta `archive` : pas de bouton, message « contactez l'équipe ».
- Admin sur `/admin/prestataires` : peut sélectionner `a_completer` pour une fiche `archive` → presta voit alors le bouton.
