# Taux de réponse prestataire — Charte Qualité Art. 2

Calcul nocturne du taux de réponse sur 90 jours glissants, seuil 72h ouvrées, alerte admin si < 70 %.

## 1. Schéma DB (migration)

**Table `prestataires`** — nouvelles colonnes :
- `taux_reponse` : `numeric(5,2)` DEFAULT `100`, nullable
- `taux_reponse_calcule_le` : `timestamptz`, nullable
- `taux_reponse_nb_demandes_90j` : `integer` DEFAULT `0` (pour affichage contextuel)
- `taux_reponse_alerte_envoyee_le` : `timestamptz`, nullable (anti-doublon notif)

**Nouvelle fonction SQL `public.calculer_taux_reponse(p_prestataire_id uuid)`** (SECURITY DEFINER) :
- Fenêtre = `now() - interval '90 days'`
- Source des demandes : `demandes_devis` filtrées par `prestataire_id` et `created_at` dans la fenêtre.
- 1re réponse = `MIN(messages.created_at)` où `demande_id = dd.id` AND `expediteur_type = 'prestataire'`.
- Délai en heures ouvrées (lundi–vendredi 9h–18h) calculé par une fonction utilitaire `public.heures_ouvrees_entre(ts_debut, ts_fin)` (boucle sur les jours, plafonne à la fenêtre 9-18h, exclut week-ends).
- Retourne `{ taux numeric, nb_demandes int }`. Si `nb_demandes = 0` → retourne `NULL` (signal "ne pas écraser").

## 2. Edge Function `cron-calcul-taux-reponse`

`supabase/functions/cron-calcul-taux-reponse/index.ts` :
- `verify_jwt = false` (dans `config.toml`)
- Service role client
- Sélectionne tous les `prestataires` avec `statut = 'actif'`
- Pour chacun, appelle `calculer_taux_reponse(id)` via RPC
- Si retour non-null :
  - `UPDATE prestataires SET taux_reponse = X, taux_reponse_nb_demandes_90j = N, taux_reponse_calcule_le = now()`
  - Si `taux < 70` AND (`taux_reponse_alerte_envoyee_le IS NULL` OR `< now() - 30 days`) :
    - INSERT `notifications` pour chaque admin (`user_id` ∈ `user_roles` rôle `admin`/`super_admin`), type alerte, lien vers fiche admin du presta
    - INSERT `logs_admin` action `revue_taux_reponse_declenchee`, entite `prestataires`, details `{ taux, nb_demandes }`
    - `UPDATE prestataires SET taux_reponse_alerte_envoyee_le = now()`
- Retourne `{ scanned, updated, alertes }`

**Cron** (via `supabase--insert`, pas migration — contient l'anon key) :
- `pg_cron` + `pg_net` activés
- Schedule `0 3 * * *` (3h du matin)

## 3. UI

**Dashboard prestataire** (`src/pages/prestataire/Dashboard.tsx`) :
- Remplacer la card "Taux de réponse" `—` par la vraie valeur
- Sous-texte : `Seuil Charte Qualité : 70 % minimum` (rouge si < 70, ambre si < 80, vert sinon)
- Tooltip : "Calculé sur 90 jours glissants à partir de vos demandes reçues et de votre première réponse."

**Dashboard admin** (`src/pages/admin/Prestataires.tsx`) :
- Nouvelle colonne "Taux réponse" avec badge rouge si < 70 %, ambre si < 80 %
- Filtre "Sous seuil Charte" pour isoler les prestataires en alerte

## 4. Détails techniques

- Heures ouvrées : fonction PL/pgSQL itère jour par jour entre `ts_debut` et `ts_fin`, additionne `LEAST(end_of_window, ts_fin) - GREATEST(start_of_window, ts_debut)` pour chaque jour ouvré, en heures.
- Source de vérité : `demandes_devis` + `messages` (déjà existants, fiables). Pas de modification de `evenements_prestataire`.
- Alerte admin anti-spam (max 1 / 30 jours par prestataire).
- Aucune suspension automatique — uniquement signalement pour revue manuelle.

## 5. Fichiers touchés

- **Migration SQL** : colonnes `prestataires`, fonctions `heures_ouvrees_entre` et `calculer_taux_reponse`
- **Insert SQL** (post-migration, via insert tool) : `pg_cron` schedule
- **Nouvelle Edge Function** : `supabase/functions/cron-calcul-taux-reponse/index.ts` + entrée `config.toml`
- **Front** : `src/pages/prestataire/Dashboard.tsx`, `src/pages/admin/Prestataires.tsx` (colonne + filtre)
