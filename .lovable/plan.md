# Audit — Servir les snapshots aux robots (lecture seule)

État constaté : bucket public `prerender-snapshots`, 121 entrées de file toutes `a_jour` avec un `storage_path` renseigné (`pages/<slug>.html`, `/` → `pages/index.html`). `vercel.json` ne contient aujourd'hui que 86 redirections héritées, aucune réécriture ni en-tête.

## 1. Point d'interception — options réellement disponibles

| Option | Fonctionnement | Couplage hébergeur | Couplage outil de dev |
|---|---|---|---|
| A. Edge Middleware Vercel (`middleware.ts` racine) | S'exécute avant tout, lit l'en-tête d'agent, réécrit vers le snapshot ou laisse passer | Fort (API `next/server` réimplémentée par Vercel, format propriétaire) | Faible (indépendant de Vite) |
| B. Vercel Function (`/api/prerender.ts`) + `rewrites` conditionnels dans `vercel.json` | La règle `rewrites` avec `has: [{type:"header",key:"user-agent",value:"(?i)...bot..."}]` route les robots vers une fonction qui va chercher le HTML dans le bucket | Moyen (syntaxe `vercel.json`, mais logique métier dans un fichier standard) | Nul |
| C. `rewrites` conditionnels pointant directement vers l'URL publique du bucket | Aucun code : `destination: "https://<bucket>/pages/:path*.html"` | Moyen (uniquement du déclaratif JSON) | Nul |
| D. Renvoi vers une Edge Function backend existante (Deno) | `rewrites` conditionnel → fonction backend qui lit la file + le bucket | Faible (la logique vit côté backend, portable vers tout hébergeur qui sait faire un proxy conditionnel) | Nul |

**Recommandation : option D**, avec repli C. Une seule ligne de `rewrites` conditionnel dans `vercel.json` (le seul artefact propriétaire, trivialement traduisible en règle Cloudflare / Netlify / nginx), et toute la logique — détection fine, correspondance URL→snapshot, 404 — dans une fonction backend Deno déjà dans le dépôt, au même endroit que le reste de la chaîne de pré-rendu. Zéro dépendance à Vite, aucune dépendance au runtime Vercel. Le middleware (A) est à éviter : c'est l'option la plus verrouillée à l'hébergeur.

## 2. Détection robot / humain

Signaux disponibles au point d'interception : en-tête `user-agent` (principal), `accept` (les robots demandent rarement autre chose que `text/html`), absence de cookie de session, et un paramètre d'échappatoire (`?_prerender=1`) pour tester.

Agents à servir en priorité, en correspondance insensible à la casse :
- Moteurs : `googlebot`, `bingbot`, `duckduckbot`, `yandex`, `baiduspider`, `applebot`, `qwantify`, `seznambot`.
- IA : `gptbot`, `oai-searchbot`, `chatgpt-user`, `perplexitybot`, `perplexity-user`, `claudebot`, `anthropic-ai`, `claude-web`, `google-extended`, `bytespider`, `amazonbot`, `meta-externalagent`, `ccbot`, `cohere-ai`, `youbot`, `diffbot`, `applebot-extended`, `mistralai-user`.
- Aperçus sociaux : `facebookexternalhit`, `twitterbot`, `linkedinbot`, `slackbot`, `whatsapp`, `discordbot`, `telegrambot`, `pinterest`.
- Filet large recommandé, conforme à votre arbitrage « dans le doute, snapshot » : tout agent contenant `bot`, `crawl`, `spider`, `slurp`, `fetch`, `preview`, `search`, ou un agent vide/absent.

Un humain servi par erreur voit une page HTML complète et statique, sans conséquence fonctionnelle grave ; on peut y adjoindre un script de réhydratation optionnel. L'inverse coûte l'indexation.

## 3. Correspondance URL → snapshot

Règle déjà figée par le générateur : chemin d'URL → `pages/<chemin sans slash initial>.html`, `/` → `pages/index.html`. Deux stratégies :
- **Directe** : construire le chemin par la même règle et lire l'objet public du bucket. Rapide, aucune requête base.
- **Autoritaire** : lire `storage_path` dans `prerender_queue` pour l'`url_path` demandé (une seule lecture indexée), puis récupérer l'objet. Plus robuste si la règle de nommage évolue, et permet de distinguer « page indexable connue mais snapshot pas encore produit » de « page inconnue ».

Le bucket étant public en lecture, la récupération est un simple GET sur l'URL publique — pas de clé de service, pas de signature. On renvoie le HTML tel quel avec `content-type: text/html`, un `cache-control` court côté périphérie, et un en-tête de traçabilité (`x-prerender: hit|miss`).

Recommandation : consultation autoritaire de la file, avec repli sur la règle directe si la lecture base échoue, puis repli sur l'application si le snapshot est introuvable — jamais d'erreur serveur visible par un robot.

## 4. Cas « pas de snapshot » et vrais 404

Oui, c'est faisable et c'est le bon endroit pour le faire. Aujourd'hui l'application est une SPA : toute URL renvoie `index.html` en 200, y compris les pages inexistantes (faux succès signalé). Au point d'interception, le statut HTTP est entièrement contrôlé, donc pour un robot :
- URL présente dans la file → snapshot, statut 200.
- URL absente de la file mais correspondant à une forme de page dynamique (fiche prestataire, article) → vérification en base de l'existence de la ressource ; absente → **404 réel** avec une page d'erreur minimale.
- URL indexable connue mais snapshot pas encore généré → laisser passer vers l'application en 200 (état transitoire, pas une absence).

Pour les humains, un vrai 404 exigerait que l'application connaisse le statut côté serveur ; le plus simple est de laisser le comportement SPA actuel et de corriger le signal uniquement pour les robots, qui sont les seuls que ce faux succès pénalise. Un rendu côté serveur généralisé serait la seule façon d'unifier les deux — [ce que l'upgrade vers TanStack Start apporterait](https://lovable.dev/blog/building-apps-using-tanstack-start), sans que ce soit nécessaire ici.

## 5. Configuration Vercel existante

`vercel.json` à la racine : **uniquement** une clé `redirects` de 86 entrées, toutes des redirections permanentes héritées de l'ancien site (`/prestataire-profil/1211-:oldslug*`, `/recherche?prestataireTypeId[]=N` vers les pages catégorie en double encodage brut et pourcent, `/actualite/...` vers `/blog`, catch-all final `/prestataire-profil/:rest*` → `/recherche`). Aucune clé `rewrites`, `headers`, `functions` ou `cleanUrls`. Aucun `middleware.ts` dans le dépôt.

Point de vigilance : chez Vercel, `redirects` s'applique **avant** `rewrites`. Ajouter un bloc `rewrites` est donc purement additif et ne peut pas casser les 86 redirections existantes — le catch-all `/prestataire-profil/:rest*` continuera de primer. À l'inverse, il faudra veiller à ce que la règle de pré-rendu n'attrape ni les fichiers d'actifs (`/assets/*`, images, `sitemap.xml`, `robots.txt`) ni les chemins d'espace privé.

## Suite possible

Sur validation, l'implémentation consisterait en : une Edge Function backend de service de snapshot, une règle `rewrites` conditionnelle unique dans `vercel.json`, et la liste d'agents centralisée dans un module partagé du dépôt.
