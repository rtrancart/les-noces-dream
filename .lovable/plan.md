# Plan : invitation prestataire robuste

## 1. Court terme — `PUBLIC_SITE_URL` preview

Ajouter le secret `PUBLIC_SITE_URL` = `https://id-preview--0e72174c-74d1-4db3-9e26-0b8167e53603.lovable.app` via le tool secrets.

Effet immédiat : les Edge Functions `invite-prestataire` et `resend-magic-link` génèreront des liens pointant vers l'URL preview au lieu de `https://lesnoces.net` (404 actuel). Le magic link Supabase natif fonctionnera enfin en preview, le temps de mettre en place le flux custom.

À la publication sur le domaine définitif (lesnoces.net), mettre à jour ce secret. À noter : le proxy preview peut encore faire échouer `POST /auth/v1/token` côté navigateur — c'est précisément pourquoi l'étape 2 est nécessaire.

---

## 2. Moyen terme — Token custom signé (HMAC `MAGIC_LINK_SECRET`)

Objectif : remplacer le magic link Supabase (consommable par Gmail/Outlook, dépendant du proxy preview) par un token signé qu'on contrôle de bout en bout.

### Architecture

```text
Admin clique "Inviter"
  └─ Edge invite-prestataire
       ├─ crée user (admin.createUser sans email)
       ├─ crée/MAJ prestataire (statut pre_inscrit)
       ├─ signe JWT HS256 { sub: user_id, presta_id, action:'accept_invitation', exp: now+7j, jti }
       ├─ stocke jti en DB (table invitation_tokens, pour révocation/usage unique)
       └─ envoie email avec lien {PUBLIC_SITE_URL}/accept-invitation?token=JWT

Prestataire clique le lien
  └─ Page /accept-invitation (front)
       ├─ POST {token} → Edge auth-verify-email-token
       │     ├─ vérifie signature + exp + jti non consommé
       │     ├─ marque jti consommé (atomique)
       │     ├─ admin.generateLink type='magiclink' email-only OU
       │     │   crée une session via admin.createSession (preferred si dispo)
       │     │   → renvoie { access_token, refresh_token } au front
       │     └─ log invitation_acceptee
       ├─ supabase.auth.setSession({ access_token, refresh_token })
       └─ Formulaire mot de passe + CGU → updateUser → /signer-la-charte
```

### Pourquoi ça résiste aux scanners
- Le token JWT n'est PAS un token Supabase. Un GET de Gmail ne consomme rien côté Supabase.
- La consommation a lieu uniquement lors du POST explicite depuis la page front (les scanners ne déclenchent pas de POST).
- `jti` en DB garantit usage unique : même si un scanner POSTait, le clic légitime suivant échouerait — donc on rend le POST déclenché par interaction (bouton "Activer mon compte") plutôt qu'auto au mount, pour éviter ce risque.

### Changements de fichiers

**Nouveaux**
- `supabase/functions/auth-verify-email-token/index.ts` — vérifie JWT, consomme `jti`, ouvre la session.
- Migration SQL : table `invitation_tokens (jti pk, user_id, presta_id, created_at, expires_at, consumed_at, ip_consumed)` + GRANTs + RLS (lecture admin only, écriture service_role).

**Modifiés**
- `supabase/functions/invite-prestataire/index.ts` — remplacer `admin.generateLink({type:'magiclink'})` par : signature JWT HS256 avec `MAGIC_LINK_SECRET` + insert `invitation_tokens`. Lien final = `${siteUrl}/accept-invitation?token=${jwt}`.
- `supabase/functions/resend-magic-link/index.ts` — même remplacement, réutilise la logique JWT (extraire dans `_shared/invitation-token.ts`).
- `src/pages/AccepterInvitation.tsx` — réécrire :
  - lit `?token=` dans l'URL
  - affiche un écran "Bienvenue, cliquez pour activer" (CTA explicite → évite déclenchement scanner)
  - au clic : `functions.invoke('auth-verify-email-token', { body:{ token } })` → reçoit `{access_token, refresh_token}` → `supabase.auth.setSession(...)` → affiche le formulaire mot de passe + CGU (logique actuelle conservée)
  - si erreur `token_expired` → écran dédié avec CTA "Demander un nouveau lien" (POST email → re-trigger `resend-magic-link` côté admin OU endpoint public rate-limité)
  - si erreur `token_consumed` → message "Ce lien a déjà été utilisé, connectez-vous normalement"
- `supabase/config.toml` — ajouter `[functions.auth-verify-email-token] verify_jwt = false` (public).
- `supabase/functions/_shared/transactional-email-templates/invitation-prestataire.tsx` — pas de changement structurel, juste le `magic_link` reste la variable (le contenu change en amont).

### Détails techniques JWT
- Algo : HS256 (symétrique, secret unique côté Supabase).
- Lib Deno : `import { create, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts"`.
- Payload : `{ sub, presta_id, action: 'accept_invitation', jti: crypto.randomUUID(), iat, exp }`.
- Expiration : 7 jours (vs 24h Supabase actuel) — paramétrable.

### Sécurité
- `MAGIC_LINK_SECRET` déjà présent ✓
- `jti` en table empêche le replay
- Token signé : non forgeable sans le secret
- Pas d'info sensible dans le payload (juste IDs)
- L'Edge Function `auth-verify-email-token` n'expose jamais service_role au client ; elle renvoie uniquement des tokens de session utilisateur

### Endpoint "renvoyer un lien" (public)
Optionnel mais recommandé : Edge `request-invitation-resend` qui prend `{email}`, vérifie qu'un prestataire en `pre_inscrit` existe, rate-limite (1/heure par email), et déclenche un nouvel email. Sinon on garde le flux admin uniquement (resend-magic-link existant).

---

## Ordre d'exécution proposé
1. Ajouter `PUBLIC_SITE_URL` (déblocage immédiat des tests).
2. Migration `invitation_tokens`.
3. Shared `_shared/invitation-token.ts` (sign + verify).
4. Edge `auth-verify-email-token` + config.toml.
5. Modifier `invite-prestataire` et `resend-magic-link`.
6. Réécrire `src/pages/AccepterInvitation.tsx` (CTA explicite, gestion erreurs).
7. Tester bout-en-bout en preview.
8. (Optionnel) Edge `request-invitation-resend` + page "lien expiré".

Confirmes-tu ce plan ? Souhaites-tu inclure l'étape 8 (auto-resend public) dès maintenant, ou la garder pour plus tard ?
