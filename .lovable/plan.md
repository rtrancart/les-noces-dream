## Objectif

Ajouter une **raison sociale** (nom légal) aux prestataires, distincte du **nom commercial**, avec un comportement de saisie « miroir + case à cocher » identique partout, y compris dans le formulaire d'inscription publique.

## 1. Base de données

Nouveau champ sur `public.prestataires` :

- **Nom technique** : `raison_sociale`
- **Type** : `text`
- **Nullable** : oui (optionnel)

Migration :

```sql
ALTER TABLE public.prestataires
  ADD COLUMN raison_sociale text;

COMMENT ON COLUMN public.prestataires.raison_sociale IS
  'Nom légal de l''entreprise (facturation, comptabilité, Charte Qualité). Souvent identique au nom_commercial.';
```

Pas de RLS à modifier. Pas de backfill : les consommateurs futurs feront `COALESCE(raison_sociale, nom_commercial)`.

## 2. Comportement UI (même règles partout)

Pattern « adresse de facturation différente » :

- Case à cocher : **« Utiliser un nom différent pour la raison sociale »**
- **Décochée (défaut)** : pas de champ visible ; `raison_sociale` suit `nom_commercial` en temps réel.
- **Cochée** : champ texte « Raison sociale » apparaît, pré-rempli avec le nom commercial courant, puis éditable indépendamment.
- **Re-décochée** : la raison sociale reprend la valeur du nom commercial (valeur saisie perdue).

À la sauvegarde, `raison_sociale` contient toujours la valeur finale. L'état de la case n'est **pas** persisté : au chargement, la case est considérée cochée si `raison_sociale IS NOT NULL AND raison_sociale <> nom_commercial`.

→ **Composant réutilisable** : `src/components/prestataire/RaisonSocialeField.tsx` (props : `nomCommercial`, `raisonSociale`, `onChange(value)`) pour un comportement identique partout.

## 3. Points d'intégration

### a. Formulaire d'inscription publique — `src/pages/Inscription.tsx`
Quand le rôle « Prestataire » est sélectionné, afficher **deux champs supplémentaires** :

1. **Nom commercial** (obligatoire) — nouveau champ contrôlé.
2. Le composant `RaisonSocialeField` (checkbox + champ conditionnel).

Ces champs ne sont **pas** affichés pour le rôle « client ».

Transmission :
- Ajouter `nom_commercial` et `raison_sociale` dans `options.data` du `supabase.auth.signUp` (metadata utilisateur).
- Mettre à jour `handle_new_user` (migration) pour lire ces deux clés du `raw_user_meta_data` et les utiliser à la création de la fiche prestataire, avec fallback sur la valeur actuelle (« Prestataire à compléter ») si absentes — le fallback préserve la compat des inscriptions déjà passées et de tout autre chemin d'appel.

### b. Espace pro — `src/pages/prestataire/Profil.tsx`
Sous « Nom commercial » dans la carte « Informations générales », insérer `RaisonSocialeField`. Étendre `form` avec `raison_sociale`, l'inclure dans `handleSave`.

### c. Back-office admin
Localiser l'écran d'édition d'une fiche prestataire (probablement dans `src/pages/admin/Prestataires.tsx` ou un dialog associé) et y insérer le même `RaisonSocialeField` sous le nom commercial.

### d. Création par admin — `supabase/functions/admin-create-user/index.ts`
Aucun changement : la fonction ne saisit pas de nom commercial aujourd'hui. La raison sociale sera renseignée via l'écran admin (point c) après création.

## 4. Hors scope

- Facturation, comptabilité, PDF Charte : consommeront `COALESCE(raison_sociale, nom_commercial)` le jour venu.
- Champs représentant légal (`representant_prenom` / `representant_nom`) : sujet séparé.

## Confirmation

Nom technique confirmé : **`raison_sociale`** (snake_case, cohérent avec `nom_commercial`).
