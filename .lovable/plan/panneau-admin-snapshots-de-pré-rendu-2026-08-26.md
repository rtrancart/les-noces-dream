# Panneau admin « Snapshots de pré-rendu »

## Audit du panneau existant (migration photos)

- `MigratePhotosBatchPanel` appelle `supabase.functions.invoke("migrate-photos-batch?batch_size=50", { method: "POST", body: {} })`. L'authentification est celle de la session admin connectée (jeton utilisateur transmis automatiquement par le client) — la fonction `migrate-photos-batch` ne fait **aucun contrôle de rôle** dans son code, elle s'exécute donc pour tout appel authentifié.
- La boucle est côté navigateur : `for (;;)` → invocation → cumul des compteurs du compte-rendu → arrêt si `done === true`, si `restantes <= 0`, ou si le bouton « Arrêter » a été pressé → pause de 1,5 s entre deux lots.
- Le compte-rendu est affiché en deux endroits : une grille de tuiles chiffrées (cumul) et le JSON brut du dernier lot.

## Point bloquant à traiter

`prerender-snapshots-batch` n'accepte aujourd'hui **que** le `service_role` (comparaison du Bearer et des claims). Un appel depuis le navigateur admin renvoie donc 401, et la clé `service_role` ne doit jamais être exposée au client. Il faut donc élargir la garde de la fonction : accepter soit le `service_role` (pour le cron), soit un utilisateur authentifié `admin` / `super_admin` vérifié côté serveur via `has_role()`. Tout autre appel reste en 401.

## Ce qui est ajouté

1. **Garde élargie** dans `supabase/functions/prerender-snapshots-batch/index.ts` : conserve la voie `service_role`, ajoute la voie « JWT utilisateur + `has_role(uid, 'admin')` ou `'super_admin'` ». Le reste de la fonction reste inchangé.
2. **Nouveau panneau** `src/components/admin/PrerenderSnapshotsPanel.tsx`, calqué sur celui de la migration photos :
   - Champ numérique « Taille du lot » (défaut 5, plafond 15, comme la fonction).
   - Bouton **« Lancer un lot de test »** : une seule invocation, sans enchaînement (utile avec taille = 1).
   - Bouton **« Traiter toute la file »** : boucle successive jusqu'à `restantes <= 0`, avec pause de 1,5 s entre lots et bouton « Arrêter après le lot en cours ».
   - Cumul affiché en tuiles : Appels, Traités, Réussis, Échoués, Ignorés, Abandonnés, Restants. JSON du dernier lot en dessous.
   - Même habillage `border-dashed` + badge « Temporaire » que le panneau migration photos.
3. **Intégration** dans `src/pages/admin/Connecteurs.tsx`, sous le panneau Migration photos.

## Détails techniques

- Invocation : `supabase.functions.invoke("prerender-snapshots-batch", { method: "POST", body: { batch_size } })` — les paramètres passent par le corps JSON (la fonction lit `body.batch_size`, `max_tentatives`, `delai_ms`, `dry_run`).
- Arrêt de boucle : `restantes <= 0`, ou `traites === 0`, ou arrêt manuel — garde-fou supplémentaire sur un nombre maximal d'itérations pour éviter toute boucle infinie si la file ne décroît pas.
- Aucune migration de base de données nécessaire.
