# Plan — Notifications email messagerie via Edge Function `relay-message`

## Objectif

Combler le gap critique : aujourd'hui un message posté dans la messagerie ne déclenche **aucune notification**. On centralise l'envoi via une Edge Function qui insère le message + déclenche le bon template email parmi 3, et on génère un magic token pour accès direct à la conversation.

---

## 1. Nouveau template email `notif-reponse-presta` (déjà présent)

Vérification rapide : le registry contient déjà `notif_reponse_presta` (notification au prestataire quand le client répond). Pas besoin de créer un nouveau template — on réutilise les 3 existants :
- `notif_reponse_client_avec_compte`
- `notif_reponse_client_sans_compte`
- `notif_reponse_presta`

Aucune migration sur `email_templates` nécessaire (les templates vivent dans le code, pas en base).

## 2. Migration DB — RLS impersonnification + colonne `envoye_par_email`

Migration unique :

```sql
-- Colonne pour traquer si la notif a été envoyée
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS envoye_par_email boolean NOT NULL DEFAULT false;

-- Bloquer les inserts en mode impersonnification
CREATE POLICY "Bloquer insert messages en impersonnification"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK ((auth.jwt() ->> 'is_impersonation')::boolean IS NOT TRUE);
```

Note : la policy existante d'insert (client/prestataire authentifié) reste en place, ce nouveau WITH CHECK s'additionne.

## 3. Edge Function `relay-message`

Fichier : `supabase/functions/relay-message/index.ts`
Config : `verify_jwt = true` dans `supabase/config.toml`.

**Flow :**

1. **Auth** — `getClaims(token)` → `user_id = claims.sub`, `is_impersonation = claims.is_impersonation`.
2. **Garde impersonnification** — si `is_impersonation === true` :
   - INSERT `logs_admin` (action `impersonation_action_bloquee`, entite `relay-message`, entite_id = user_id, details `{action_tentee:'relay-message'}`)
   - retour 403.
3. **Validation body** (Zod) : `demande_id` uuid, `contenu` string (1..5000), `expediteur_type` enum `prestataire|visiteur`.
4. **Contexte** via service role : `SELECT` `demandes_devis` + join `prestataires` (nom_commercial, telephone, email_contact, site_web, user_id, slug) + join `contacts_anonymes` (email, prenom, profile_id) + `profiles` client (prenom, email) si `profile_id IS NOT NULL`. Si demande introuvable / archivée → 400.
5. **Autorisation métier** — vérifier que `user_id` correspond bien soit au prestataire (`prestataires.user_id`), soit au client (`profile_id`). Sinon 403.
6. **INSERT message** (service role) avec `expediteur_id = user_id`.
7. **UPDATE statut** demande à `en_discussion` si `statut IN ('nouveau','lu')`.
8. **Magic token** — JWT signé HS256 avec `MAGIC_LINK_SECRET` : `{sub, demande_id, exp: now+7j, action:'reply'}`.
9. **Dispatch email** selon cas A/B/C (cf. ci-dessous) via `supabase.functions.invoke('send-transactional-email', { body: { templateName, recipientEmail, idempotencyKey: 'msg-'+message_id, templateData } })`.
10. **UPDATE** `messages.envoye_par_email = true` si succès email.
11. Retour `{success:true, message_id, email_error?:true}`.

**Cas email :**

| Cas | Trigger | Template | Destinataire |
|---|---|---|---|
| A | `prestataire` + `profile_id` ≠ null | `notif_reponse_client_avec_compte` | `profiles.email` |
| B | `prestataire` + `profile_id` null | `notif_reponse_client_sans_compte` | `contacts_anonymes.email` |
| C | `visiteur` | `notif_reponse_presta` | `prestataires.email_contact` |

**Variables injectées :**
- A : `clientPrenom`, `prestataireNom`, `messageExtrait`, `lienMessagerie = https://lesnoces.net/mon-espace/messages/{demande_id}?token={magic}`
- B : `clientPrenom`, `prestataireNom`, `messageExtrait`, `lienMagique = https://lesnoces.net/messagerie/{demande_id}?token={magic}`, `lienInscription = https://lesnoces.net/inscription?email={enc}&demande_id={id}`
- C : variables équivalentes côté presta (à confirmer avec le template `notif-reponse-presta.tsx` existant)

**Secret requis :** `MAGIC_LINK_SECRET` — à ajouter via `add_secret`. Utilisé uniquement côté Edge Function pour signer/vérifier les magic tokens de conversation.

## 4. Modification `src/components/messaging/ConversationThread.tsx`

Remplacer `handleSend` :

```ts
const handleSend = async () => {
  if (!newMessage.trim() || !user?.id || sending) return;
  setSending(true);

  const { data, error } = await supabase.functions.invoke('relay-message', {
    body: { demande_id: demandeId, contenu: newMessage.trim(), expediteur_type: role },
  });

  if (error || !data?.success) {
    toast({ title: "Votre message n'a pas pu être envoyé, veuillez réessayer.", variant: "destructive" });
  } else {
    setNewMessage("");
    trackEvent("envoi_message", { role });
    onMessageSent?.();
  }
  setSending(false);
};
```

→ Suppression du `insert` direct et du `update` statut (déplacés serveur).
→ Le realtime subscribe existant affichera le message une fois inséré.

## 5. Config

Ajouter dans `supabase/config.toml` :
```toml
[functions.relay-message]
verify_jwt = true
```

## 6. Hors-scope explicite

- Pas de modif des templates existants (juste les appeler).
- Pas de table `email_templates` (les templates sont des composants React Email).
- Pas de page publique `/messagerie/{id}?token=…` dans ce plan — à traiter dans un plan suivant (route + validation token côté serveur). En attendant, le `lienMagique` envoie vers une route à créer ; les clients avec compte fonctionneront immédiatement via `/mon-espace/messages`.
- L'impersonnification (table `sessions_impersonnification`, Edge Function `admin-impersonate`, etc.) reste sur son plan dédié — ici on ne fait que poser le garde-fou dans `relay-message` + la policy RLS qui lisent un claim JWT `is_impersonation` qui sera renseigné par ce futur flux.

## Risques

- **Magic token vers `/messagerie/{id}`** : route inexistante pour les clients sans compte. À planifier ensuite, sinon le CTA mène à un 404. Acceptable court-terme car le template prévoit aussi un CTA "Créer mon compte".
- **Doublon de notification** si le client clique vite sur Envoyer 2× : l'`idempotencyKey = msg-{message_id}` rend l'envoi idempotent côté `send-transactional-email`.
