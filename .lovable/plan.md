## Diagnostic

Erreur RLS lors du passage `a_completer` → `en_attente` sur `prestataires` : la policy UPDATE de `prestataires` autorise bien le propriétaire, mais le trigger AFTER `trg_log_statut_transition` appelle `public.log_statut_transition()` qui fait un `INSERT INTO public.logs_admin`. Cette fonction n'est **pas** `SECURITY DEFINER` — elle s'exécute donc avec le rôle du prestataire, et la policy INSERT de `logs_admin` exige `has_role(admin | super_admin)` → « new row violates row-level security policy for table "logs_admin" ».

## Audit des autres triggers du schéma public

Passé en revue tous les triggers non-internes du schéma `public` (via `pg_trigger`), en croisant : (a) déclenchable par un utilisateur non-admin, (b) écrit dans une table protégée par RLS restrictive, (c) pas déjà `SECURITY DEFINER`.

| Trigger / fonction | Écrit dans | Déclenchable par non-admin ? | SECURITY DEFINER ? | Verdict |
|---|---|---|---|---|
| `log_statut_transition` | `logs_admin` (INSERT réservé admin) | Oui (prestataire modifie sa fiche) | Non | **À corriger** |
| `sync_note_prestataire` | `prestataires` | Oui (dépôt d'avis) | Oui | OK |
| `on_signature_charte_created` | `prestataires` (statut `actif`) | Oui (prestataire signe la charte) | Non | OK — la policy « Owner can update own prestataire » couvre l'écriture, et le trigger BEFORE `prevent_direct_actif_write` est levé via `app.allow_actif_write` posé par la fonction elle-même. Pas de cross-table protégée. |
| `on_prestataire_validation` | Aucune écriture cross-table (modifie NEW) | — | Non | OK |
| `prevent_direct_actif_write`, `prevent_origine_prestataire_modification`, `prevent_archived_version_modification`, `prevent_signature_modification`, `prevent_invitation_token_proof_modification`, `chartes_versions_enforce_hash` | RAISE / modifie NEW | — | — | OK (pas d'INSERT cross-table) |
| `update_updated_at_column` (générique) | Colonne locale | — | — | OK |

**Une seule fonction à corriger : `log_statut_transition`.**

## Correctif

Migration unique :

1. `CREATE OR REPLACE FUNCTION public.log_statut_transition()` avec le corps actuel inchangé, mais en ajoutant :
   - `SECURITY DEFINER`
   - `SET search_path = public` (verrouillage du search_path, requis pour toute fonction DEFINER — évite le hijack par un schéma tiers).

Aucune modification :
- au trigger `trg_log_statut_transition` lui-même,
- aux policies de `logs_admin` ou `prestataires`,
- au frontend (`src/pages/prestataire/Profil.tsx`).

## Vérification

Après migration : reprendre la soumission de la fiche Test 01 depuis `/pro/profil` → la fiche passe en `en_attente` sans erreur, et une ligne apparaît dans `logs_admin` (action `statut_transition`, ancien = `a_completer`, nouveau = `en_attente`, `auto = true` puisque `auth.uid()` n'est pas admin, `admin_id` = user_id du prestataire), visible dans l'admin Logs.
