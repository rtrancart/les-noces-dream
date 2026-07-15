## Diagnostic

Le flux actuel de `subscribe()` en iframe fait un **aller-retour en 2 étapes** :

1. Clic sur « Passer à cette formule » → on met `window.top.location.href = /espace-pro/abonnement?checkout=premium` (juste l'URL de l'app, pas Stripe).
2. Au rechargement top-level, le `useEffect` lit `?checkout=premium` et appelle enfin l'edge function `stripe-create-checkout` pour obtenir l'URL Stripe, puis redirige.

En prévisualisation Lovable, `window.top` correspond à l'éditeur Lovable (cross-origin). L'écriture `window.top.location.href` est souvent bloquée silencieusement par la politique de l'iframe (pas de `allow-top-navigation`), donc rien ne se passe visiblement, et le fallback `StripeRedirectNotice` s'affiche avec un lien `target="_top"` qui pointe… vers l'app avec `?checkout=premium`, pas vers Stripe. Cliquer ce lien retombe dans la même impasse.

## Correctif proposé

Supprimer complètement l'aller-retour en 2 étapes et fabriquer directement l'URL Stripe avant toute tentative de navigation. Un seul chemin, robuste, quelle que soit la politique d'iframe.

### Nouveau comportement de `subscribe(formule)`

1. Marquer `submitting = formule`.
2. Appeler `supabase.functions.invoke("stripe-create-checkout")` **tout de suite** (même en iframe) → on récupère `data.url` (URL Stripe réelle).
3. Tenter la navigation dans l'ordre suivant :
   - `window.top.location.href = data.url` (si `window.top` accessible).
   - Sinon `window.location.href = data.url` (navigue l'iframe elle-même vers Stripe).
4. Toujours afficher `StripeRedirectNotice` avec l'**URL Stripe** (`data.url`) et `target="_top"`, comme filet de sécurité si la navigation programmatique est bloquée. Le clic utilisateur, lui, dispose de l'activation nécessaire pour `target="_top"` et fonctionne dans quasi tous les cas.
5. En cas d'erreur de l'edge function, toast d'erreur, `submitting = null`, pas de notice.

### Nettoyage

- Supprimer `buildTopLevelCheckoutUrl`, la branche `checkout=` dans le `useEffect` de synchronisation des searchParams, et l'`success_url`/`cancel_url` restent inchangés (déjà côté edge function).
- Garder la lecture de `?statut=succes|annule` inchangée.
- `createCheckoutSession` et `subscribe` fusionnent en une seule fonction claire.

### Fichier modifié

- `src/pages/prestataire/Abonnement.tsx` uniquement. Aucune modification côté edge function ni base.

### Vérification

- Depuis la preview mobile (390px), cliquer « Passer à cette formule » sur Premium → soit la page part directement sur `checkout.stripe.com`, soit la bannière « Continuer vers Stripe » apparaît avec un lien qui, au clic, ouvre Stripe dans le même onglet (top).
- Vérifier que la carte de la formule actuelle reste grisée et non cliquable.
- Vérifier que le retour `?statut=succes` ou `?statut=annule` affiche toujours le toast.