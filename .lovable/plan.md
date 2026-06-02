## Problème

Après validation du mot de passe sur `/accept-invitation`, `navigate("/signer-la-charte")` se déclenche mais la page reste bloquée sur le loader. Un refresh manuel résout le souci → la session est correcte, c'est `isLoading` de `AuthContext` qui ne redescend jamais.

## Cause racine

Dans `src/contexts/AuthContext.tsx` :

- `onAuthStateChange` (ligne 78) appelle `applySession`, qui fait `setIsRoleLoading(true)` à **chaque** événement auth — y compris `USER_UPDATED` émis par `supabase.auth.updateUser({ password })`.
- L'effet qui charge profil + rôles (ligne 101-104) ne se redéclenche que quand `user?.id` change. Or après un `updateUser`, l'id reste le même → l'effet ne tourne pas → `isRoleLoading` reste bloqué à `true` → `isLoading` reste `true` → `SignerLaCharte` affiche le loader indéfiniment.

Au refresh, `initAuth` recharge la session, `user?.id` "réapparaît" (passe de undef à défini), le fetch tourne, `isRoleLoading` redescend → la page de signature s'affiche.

## Correctif

**Un seul fichier : `src/contexts/AuthContext.tsx`**

1. Ne plus déclencher `setIsRoleLoading(true)` aveuglément dans `applySession`. Le faire uniquement quand `nextSession?.user?.id` est **différent** de l'`user.id` déjà connu (vraie connexion / déconnexion / changement d'utilisateur).
2. Pour les events `USER_UPDATED` (même uid), simplement mettre à jour `session`/`user` sans repasser en loading — le profil/rôles déjà chargés restent valides.

Pseudo-code de la modif :

```text
const applySession = (nextSession) => {
  const prevUid = userRef.current?.id;
  const nextUid = nextSession?.user?.id ?? null;

  setSession(nextSession);
  setUser(nextSession?.user ?? null);

  if (nextUid !== prevUid) {
    // vrai changement d'identité → recharger profil + rôles
    setIsRoleLoading(Boolean(nextUid));
    if (!nextSession) { setProfile(null); setRoles([]); }
  }
  // sinon : USER_UPDATED, TOKEN_REFRESHED, etc. → ne pas toucher au loading
};
```

Utiliser une `ref` (`userRef`) synchronisée avec `user` pour comparer l'uid sans dépendre du state asynchrone.

## Hors scope

- Aucune modif d'Edge Function, de DB, ni de `AccepterInvitation.tsx` / `SignerLaCharte.tsx`.
- Le flux d'invitation (token, verifyOtp) déjà corrigé reste inchangé.

## Validation

1. Nouveau test prestataire → clic magic link → définir mot de passe → la redirection vers `/signer-la-charte` doit s'afficher immédiatement, sans refresh.
2. Vérifier que la connexion classique et la déconnexion fonctionnent toujours (le loader doit toujours apparaître sur un vrai login).
