# Empêcher l'indexation des URLs /admin

## Objectif
Ajouter les deux signaux d'exclusion manquants dans ce qui est réellement servi aux robots, sans toucher à l'authentification, au pré-rendu, ni aux autres routes.

## 1. robots.txt
Dans `public/robots.txt`, ajouter sous le bloc `User-agent: *`, à côté des exclusions existantes :

```text
Disallow: /admin
```

Cette forme couvre `/admin` et toutes ses sous-routes. Les autres blocs (Googlebot, Bingbot, IA, sociaux) et la ligne `Sitemap:` restent inchangés.

## 2. Signal noindex dans la réponse servie
Deux façons de le faire côté serveur. La réponse d'une route `/admin` est le fichier statique `dist/index.html` : aucun rendu serveur n'existe pour y insérer une balise différente selon l'URL. L'équivalent officiel et strictement prioritaire, reconnu par Google, Bing et les autres, est l'en-tête HTTP `X-Robots-Tag`.

Approche retenue : ajouter une section `headers` dans `vercel.json` (le fichier n'en a pas encore) :

```json
"headers": [
  {
    "source": "/admin",
    "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }]
  },
  {
    "source": "/admin/:path*",
    "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }]
  }
]
```

Effet : toute requête sur `/admin` ou une sous-route, y compris d'un robot qui n'exécute pas le JavaScript, reçoit le signal `noindex, nofollow` dès la réponse HTTP. Le corps de la réponse et le fonctionnement de l'application ne changent pas ; les autres routes ne sont pas concernées (les en-têtes ne s'appliquent qu'aux sources listées).

Le `noindex` posé par `AdminLayout` en JavaScript reste en place — il devient une seconde ceinture, cohérente avec l'en-tête.

## Ce qui n'est pas modifié
- `middleware.ts` (racine `/` uniquement) et son rôle de bascule robot/humain.
- L'exclusion existante de `/admin` du pré-rendu (regex de réécriture + `PREFIXES_EXCLUS` dans `prerender-serve`).
- La logique d'authentification et les gardes de routes.
- Les autres règles de `robots.txt`, les redirections et réécritures existantes.

## Vérification
- Après publication : `curl -sI https://lesnoces.net/admin` et `/admin/prestataires` doivent montrer `x-robots-tag: noindex, nofollow`.
- `curl -s https://lesnoces.net/robots.txt` doit contenir `Disallow: /admin`.
- Contrôle qu'une route publique (par exemple `/`) ne porte pas cet en-tête.
- Le back-office s'ouvre et se navigue normalement.

## Note
Ces changements ne prennent effet sur le site en ligne qu'à la prochaine publication. Les URLs `/admin` déjà connues de Google disparaissent des résultats après un nouveau passage du robot ; la suppression peut être accélérée via la Search Console.
