## Correctif Edge Function `auth-verify-email-token`

### Problème
Le `fetch` manuel vers `/auth/v1/verify` renvoie 400 — "Only an email address or phone number should be provided on verify". L'API attend `token_hash` (sans email), pas `token`.

### Fix (1 fichier)

**`supabase/functions/auth-verify-email-token/index.ts`** — remplacer le bloc fetch manuel par le SDK officiel :

```ts
const anon = createClient(supabaseUrl, anonKey);
const { data: sessionData, error: verifyErr } = await anon.auth.verifyOtp({
  type: "magiclink",
  token_hash: hashedToken,
});
if (verifyErr || !sessionData?.session) {
  console.error("[auth-verify] verifyOtp failed", { jti: payload.jti, err: verifyErr?.message });
  return json({ error: "session_exchange_failed", detail: verifyErr?.message }, 500);
}
return json({
  success: true,
  access_token: sessionData.session.access_token,
  refresh_token: sessionData.session.refresh_token,
  user: { id: payload.sub, email },
  prestataire_id: payload.presta_id,
});
```

### Logs défensifs
Ajouter `console.error` avec `payload?.jti` sur chaque branche d'erreur (`token_invalid`, `db_error`, `user_not_found`, `session_generation_failed`, `session_exchange_failed`, `unexpected`) pour diagnostiquer plus rapidement.

### Déploiement & validation
1. `deploy_edge_functions(["auth-verify-email-token"])`
2. Renvoyer une invitation depuis `/admin/prestataires` à un 3ᵉ test prestataire (les 2 précédents ont leur `jti` consommé).
3. Cliquer le lien → "Activer mon compte" → vérifier session + redirection vers le formulaire mot de passe.
4. Consulter `edge_function_logs("auth-verify-email-token")` en cas d'échec.

### Hors scope
Aucune migration DB, aucun changement frontend, aucun changement à `invite-prestataire` / `resend-magic-link`.
