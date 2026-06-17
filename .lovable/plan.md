## Problème

La table `realtime.messages` n'a pas de RLS. Sans verrou au niveau topic, un utilisateur authentifié peut s'abonner à `messages-<n'importe quel demande_id>` et recevoir les broadcasts. La RLS de `public.messages` filtre déjà le payload via `postgres_changes`, mais l'autorisation au niveau du topic doit aussi être verrouillée.

## Approche

1. Activer le mode "Private channels" côté client, ce qui force Realtime à consulter la RLS de `realtime.messages` à la souscription.
2. Activer RLS sur `realtime.messages` avec deux policies SELECT scopées par topic et `auth.uid()`.

## Migration

```sql
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Participants d'une demande peuvent s'abonner à messages-<demande_id>
CREATE POLICY "Participants can subscribe to conversation channel"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (
      realtime.topic() LIKE 'messages-%'
      AND EXISTS (
        SELECT 1 FROM public.demandes_devis dd
        WHERE dd.id::text = substring(realtime.topic() FROM 'messages-(.*)')
          AND (
            dd.profile_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.prestataires p
              WHERE p.id = dd.prestataire_id AND p.user_id = auth.uid()
            )
          )
      )
    )
  );

-- Chaque utilisateur peut s'abonner uniquement à son propre topic sidebar
CREATE POLICY "User can subscribe to own sidebar channel"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.topic() = 'sidebar-unread-' || auth.uid()::text
  );
```

## Refactor code

- `src/components/messaging/ConversationThread.tsx` : ajouter `{ config: { private: true } }` à `supabase.channel(\`messages-${demandeId}\`, ...)`.
- `src/components/prestataire/PrestataireSidebar.tsx` :
  - ajouter `user` à la destructuration `useAuth()` (déjà importé),
  - **guard explicite** `if (!user?.id) return;` avant le `supabase.channel(...)` dans le `useEffect`, pour éviter tout `sidebar-unread-undefined` au premier render,
  - renommer le canal en `` `sidebar-unread-${user.id}` ``,
  - ajouter `{ config: { private: true } }`,
  - inclure `user?.id` dans les dépendances du `useEffect`.

Aucun autre changement de logique ; callbacks `postgres_changes` et `fetchUnread()` inchangés.

## Vérification

- Conversation : envoi/réception instantanés pour les deux participants.
- Un tiers ne peut plus s'abonner à `messages-<demande_id>` d'une conversation dont il n'est pas participant.
- Badge "non lus" de la sidebar prestataire fonctionne toujours, sans souscription tant que `user` n'est pas chargé.
- Re-run scanner : `messages_realtime_no_channel_auth` doit se fermer.
