## Edge Function `migrate-photos-batch`

Base validée : lot 20, principale KO préserve la colonne existante, fiche sans prestataire reste `traite=false` avec log, borne regex stricte, `Promise.allSettled` par fiche.

### Fichier créé

`supabase/functions/migrate-photos-batch/index.ts` (nouvelle fonction, indépendante de `migrate-photos-oldsite`).

### Logique

1. **Sélection du lot** : `SELECT legacy_id, photo_principale, galerie FROM migration_photos_mapping WHERE traite = false ORDER BY legacy_id LIMIT 20` (paramètre `?batch_size=N` optionnel, borné à 50).

2. **Résolution legacy_id → UUID (borne stricte)** :
   - Un seul `SELECT` par lot sur `prestataires` avec regex POSIX :
     ```
     notes_pre_inscription ~ '\[legacy_id\]\s+(7|9|10|...)\M'
     ```
     `\M` = fin de mot POSIX Postgres → `7` ne matche jamais `70`, `17` ne matche jamais `170`.
   - Extraction TS avec `/\[legacy_id\]\s+(\d+)\b/`, puis vérification que l'entier extrait est bien dans la liste du lot (double sécurité).
   - Map en mémoire `legacy_id → uuid`.

3. **Traitement fiche par fiche** :
   - **Si `uuid` absent** → `UPDATE migration_photos_mapping SET traite=false, erreurs='prestataire introuvable'`. **Non archivée**, reste visible.
   - **Sinon** :
     - `Promise.allSettled([principale, ...galerie])` : chaque photo est indépendante. Un fetch qui throw, un 404, un timeout, un upload storage KO → n'interrompt jamais les autres.
     - Chaque `uploadOne` a en plus son propre `try/catch` interne et retourne `{ok:true, publicUrl}` ou `{ok:false, error}` — `allSettled` est la ceinture par-dessus les bretelles.
     - Pour chaque résultat : si `status='fulfilled'` et `value.ok` → succès ; sinon (rejected OU fulfilled mais ok=false) → échec, consigné dans `erreurs`.

4. **Écriture DB fiche** :
   - `photo_principale_url` : uniquement ajoutée au `UPDATE` si succès. Sur échec, colonne intacte (jamais NULL).
   - `urls_galerie` (`text[]`) : tableau des URLs OK dans l'ordre source, échecs omis.
   - `UPDATE migration_photos_mapping SET traite=true, erreurs=<log|null>`.

5. **Format `erreurs`** (multi-ligne) :
   ```
   principale:jakob-owens.jpg:HTTP 404
   galerie:castille-2.jpg:HTTP 500
   galerie:foo.jpg:exception: fetch failed
   ```

6. **Exceptions résiduelles** (seuls cas qui laissent la fiche `traite=false`) :
   - Résolution UUID → gérée séparément (message dédié).
   - `UPDATE prestataires` KO → `erreurs='db update: ...'`, retry au prochain appel.
   - Exception fiche-level catch-all → `erreurs='exception: ...'`.
   - **Aucun fichier ne peut faire tomber une fiche** grâce à `allSettled`.

7. **Réponse JSON** :
   ```json
   {
     "batch_size": 20,
     "fiches_traitees": 19,
     "fiches_sans_prestataire": 1,
     "fichiers_ok": 187,
     "fichiers_ko": 3,
     "restantes": 3186,
     "details": [{ "legacy_id": 7, "uuid": "...", "principale": "ok", "galerie_ok": 27, "galerie_ko": 0 }]
   }
   ```

### Config

- `[functions.migrate-photos-batch] verify_jwt = true` dans `supabase/config.toml`.
- Utilise `SUPABASE_SERVICE_ROLE_KEY` (déjà en secrets).

### Utilisation

Appel POST répété jusqu'à `restantes = 0` (~160 appels pour 3 206 fiches).
