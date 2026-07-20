
## Contexte

Le template `notif-reponse-client-sans-compte.tsx` (envoyé quand un prestataire répond à un couple qui n'a pas de compte) propose aujourd'hui un CTA « Lire et répondre » pointant vers `https://lesnoces.net/messagerie/{demande_id}?token={magic}`. **Cette route n'existe pas** dans `src/App.tsx` (seule `/mon-espace/messagerie` est déclarée, et elle est protégée). Le client sans compte tombe donc sur un 404 / redirection connexion — il ne peut pas répondre.

## Nouveau comportement souhaité

- Afficher les **coordonnées du prestataire** (nom, email, téléphone si dispo) pour que le couple puisse répondre directement par email/téléphone hors plateforme.
- Conserver un CTA secondaire **« Créer mon compte »** avec un texte indiquant qu'il retrouvera l'**historique de ses conversations** sur son espace.
- Supprimer le CTA magic link « Lire et répondre » et la mention « Lien sécurisé, valable 30 jours ».
- Supprimer la génération du magic token dans le cas B pour ne plus laisser traîner de lien mort.

## Changements

### 1. `supabase/functions/relay-message/index.ts`

Dans le CAS B (`expediteur_type === 'prestataire' && !demande.profile_id`) :

- Récupérer aussi `email_contact` et `telephone` du prestataire dans la requête `select` existante.
- Remplacer `templateData` par :
  ```
  {
    clientPrenom,
    prestataireNom: presta.nom_commercial,
    prestataireEmail: presta.email_contact,
    prestataireTelephone: presta.telephone ?? null,
    messageExtrait,
    lienInscription: `https://lesnoces.net/inscription?email=…&demande_id=…`,
  }
  ```
- Ne plus passer `lienMagique`.

### 2. `supabase/functions/_shared/transactional-email-templates/notif-reponse-client-sans-compte.tsx`

- Remplacer la carte « lienMagique + hint » par une **carte coordonnées** : label « Répondre directement à {prestataireNom} », lignes email (lien `mailto:`) et téléphone (lien `tel:` si présent).
- Reformuler le texte d'intro : « … vient de répondre à votre demande. Vous pouvez lui répondre directement par email ou téléphone ci‑dessous. »
- Conserver le séparateur « — OU — » et le bloc « Créez votre compte gratuit », en ajustant le texte : « Créez un compte gratuit pour retrouver **l'historique de toutes vos conversations** et centraliser l'organisation de votre mariage. »
- Mettre à jour `previewData` (ajouter `prestataireEmail`, `prestataireTelephone`, retirer `lienMagique`).
- Mettre à jour l'interface `Props`.

### 3. Déploiement

Redéployer `relay-message` et `send-transactional-email` (le template est embarqué dans le second à l'exécution).

## Points hors scope

- Pas de création de route `/messagerie/:demande_id` publique ni d'accès invité — décision produit : la conversation continue par email direct.
- Le cas A (client **avec** compte) reste inchangé — son lien `/mon-espace/messages/{demande_id}` fonctionne via l'espace protégé.
- La notif prestataire (cas C, `notif_reponse_presta`) souffre probablement du même problème de route (`/pro/messages/:demande_id`) — **à confirmer avec vous** dans un second temps si vous voulez qu'on la corrige aussi.
