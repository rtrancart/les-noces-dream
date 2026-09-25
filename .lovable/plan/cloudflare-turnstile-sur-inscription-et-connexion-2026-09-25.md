# Cloudflare Turnstile sur inscription et connexion

## Objectif
Ajouter un contrôle anti-robot Cloudflare Turnstile sur les pages Connexion et Inscription (futurs mariés et prestataires, même formulaire). Le bouton reste désactivé tant que le contrôle n'est pas validé, et le widget se réinitialise après chaque erreur.

## Ce qui change pour l'utilisateur
- Un petit encadré Cloudflare apparaît au-dessus du bouton « Se connecter » / « Créer mon compte ».
- Le bouton reste grisé jusqu'à la validation (souvent automatique et invisible).
- Après un mauvais mot de passe ou une erreur d'inscription, le contrôle se relance automatiquement.

## Étapes
1. Ajouter le paquet `@marsidev/react-turnstile` (petit composant React officiel communautaire).
2. Créer un composant réutilisable `TurnstileWidget` (lit `VITE_TURNSTILE_SITE_KEY`, expose `onToken`, `onExpire`, `onError`, et une méthode `reset()` via ref ; langue `fr`, thème clair).
3. `src/pages/Connexion.tsx` : état `captchaToken`, bouton désactivé si absent, passage de `options: { captchaToken }` à `signInWithPassword`, reset du widget + vidage du token après erreur (le token Turnstile est à usage unique).
4. `src/pages/Inscription.tsx` : même logique dans `signUp` (`options.captchaToken` à côté de `emailRedirectTo` et `data`).
5. Ajouter `VITE_TURNSTILE_SITE_KEY` dans `.env.example` (la clé de site est publique ; la valeur réelle doit aussi être ajoutée dans les variables d'environnement Vercel pour la production).

## Point bloquant à connaître
Le jeton n'est réellement vérifié que si la protection CAPTCHA est activée côté service d'authentification avec la **clé secrète** Turnstile. Tant que ce n'est pas activé, le widget s'affiche mais n'apporte aucune protection. Dès qu'il est activé, **tous** les appels d'authentification sans jeton seront refusés, notamment :
- la re-vérification du mot de passe actuel dans Paramètres (prestataire et client), qui utilise `signInWithPassword` ;
- la demande « Mot de passe oublié » (`resetPasswordForEmail`) ;
- éventuels flux admin (impersonation / magic link côté serveur non concernés car ils passent par la clé de service).

Proposition : ajouter aussi le widget sur Mot de passe oublié, et remplacer la re-vérification des Paramètres par `updateUser({ password, current_password })` (qui ne demande pas de CAPTCHA). À confirmer avant activation côté serveur.

## Détails techniques
- Widget : `<Turnstile siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY} options={{ language: "fr", theme: "light" }} onSuccess={setToken} onExpire={() => setToken(null)} onError={() => setToken(null)} ref={turnstileRef} />`.
- Si la variable d'env est absente : afficher un message discret et laisser le bouton désactivé (pas de contournement silencieux).
- Domaines à déclarer dans le tableau de bord Cloudflare Turnstile : `lesnoces.net`, `www.lesnoces.net`, `les-noces.lovable.app`, le domaine de preview Vercel et `localhost`.
- Aucun changement de base de données ni de fonction serveur.
