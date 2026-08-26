# Fonction de génération des snapshots de pré-rendu

## Audit de l'existant

### 1. Secrets
Les secrets sont toujours lus via `Deno.env.get("NOM")` dans les fonctions serveur, jamais écrits en dur : `BREVO_API_KEY` (client Brevo partagé), `PENNYLANE_API_TOKEN`, `MAGIC_LINK_SECRET`, `BREVO_WEBHOOK_SECRET`. Ils sont enregistrés côté plateforme (outil de gestion des secrets) puis simplement lus à l'exécution.
Deux nouveaux secrets à créer, nommés explicitement :
- `PRERENDER_SERVICE_URL` — adresse du service de rendu headless.
- `PRERENDER_SERVICE_TOKEN` — jeton d'accès envoyé en en-tête d'autorisation.

### 2. Modèle de traitement par lots existant
Deux patterns éprouvés dans le projet :
- `migrate-photos-batch` : lit N lignes non traitées (`statut`/`traite` + `order` + `limit`), traite chaque ligne indépendamment, `Promise.allSettled` pour qu'un échec n'interrompe rien, écrit le motif d'échec sur la ligne sans la marquer terminée, renvoie un compte-rendu chiffré + `restantes` pour permettre la reprise.
- `brevo-sync-compteurs` : authentification par `service_role` (comparaison du Bearer aux claims), budget de temps par passe (`BUDGET_MS ≈ 40 s`) et arrêt propre avant le timeout, journalisation du résultat (`statut`, `tentatives`, `dernier_motif`, `dernier_status`).

La file `prerender_queue` est déjà taillée pour ce modèle : `statut` (`a_traiter` / `a_jour` / `abandonne`), `tentatives`, `dernier_motif`, `dernier_status`, `signature_visible` vs `signature_rendue`, `storage_path`, `rendu_le`, plus un index partiel sur les entrées `a_traiter`.

### 3. Écriture dans un bucket depuis une fonction
Comme dans `migrate-photos-batch` : client `service_role`, puis `supabase.storage.from(BUCKET).upload(path, bytes, { contentType, upsert })`. Le bucket `prerender-snapshots` existe déjà et est public en lecture (politique SELECT ouverte), donc le chemin déterministe suffit à servir le HTML.

## Découpage proposé de la fonction `prerender-snapshots-batch`

1. **Garde d'accès** — accepte uniquement un appel `service_role` (même contrôle que `brevo-sync-compteurs`), CORS + `OPTIONS`.
2. **Paramètres** — `batch_size` (défaut 5, plafond 15), `max_tentatives` (défaut 3), `delai_ms` entre rendus (défaut 1500), `dry_run`. Budget de temps global ≈ 40 s : la boucle s'arrête dès qu'il est dépassé, le reste sera repris par le rattrapage.
3. **Sélection du lot** — `statut = 'a_traiter'`, tri sur `updated_at` (index dédié), `limit batch_size`.
4. **Boucle séquentielle, une entrée à la fois** (jamais de parallélisme : le service ne rend qu'une page à la fois) :
   - a. **Court-circuit signature** : si `signature_visible` est non nulle et égale `signature_rendue`, marquer `a_jour` (tentatives remises à 0, motif effacé) sans appeler le service. Compté en « ignorés ».
   - b. **Appel du rendu** (format Browserless v2) : `POST {PRERENDER_SERVICE_URL}/chromium/content?token={PRERENDER_SERVICE_TOKEN}` (token en paramètre d'URL), corps JSON `{ "url": "...", "waitForFunction": { "fn": "() => window.__PRERENDER_READY__ === true", "timeout": 30000 } }` — au-delà du plafond interne de 20 s de la page. L'URL absolue est reconstruite depuis le site public + `url_path`.
   - c. **Succès** : upload immédiat du HTML dans `prerender-snapshots` sur un chemin déterministe dérivé de `url_path` (ex. `pages/<slug-du-chemin>.html`, `text/html; charset=utf-8`, `upsert: true`), puis mise à jour de la ligne : `statut = 'a_jour'`, `signature_rendue = signature_visible`, `storage_path`, `rendu_le = now()`, `tentatives = 0`, `dernier_motif = null`. Le HTML est libéré avant l'entrée suivante — aucun cumul en mémoire.
   - d. **Échec** (HTTP non 2xx, timeout, page signalant une erreur de pré-rendu, échec d'upload) : `tentatives + 1`, `dernier_motif` lisible et tronqué, `dernier_status` si disponible ; si `tentatives >= max_tentatives` → `statut = 'abandonne'`, sinon la ligne reste `a_traiter` et sera rejouée.
   - e. **Backoff** : pause `delai_ms` entre deux appels au service.
5. **Compte-rendu** — `{ ok, traites, reussis, echecs, ignores, abandonnes, restantes, duree_ms }`. Jamais de HTML dans la réponse ni dans les logs.
6. **Hors périmètre ici** : le cron de rattrapage et l'alimentation de la file (`signature_visible`), traités plus tard.

## Détails techniques
- Aucune migration nécessaire : la table et le bucket couvrent déjà tous les champs requis.
- Nouveaux secrets `PRERENDER_SERVICE_URL` et `PRERENDER_SERVICE_TOKEN` — j'attends leurs valeurs.
- Contrat attendu du service de rendu : `/chromium/content` renvoie directement le corps HTML brut. La garantie de succès vient du fait que `waitForFunction` a abouti ; tout échec / timeout est traité comme un échec rejouable.
