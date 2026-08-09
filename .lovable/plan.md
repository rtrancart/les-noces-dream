# Consentement marketing des mariés

Ajouter une case à cocher RGPD à l'inscription des futurs mariés, stocker le choix en base, et permettre de le modifier depuis l'espace client — avec propagation vers le CRM.

## Ce que voit l'utilisateur

**À l'inscription (rôle « Futur·e marié·e » uniquement)**
- Une case à cocher **décochée par défaut**, jamais obligatoire pour créer le compte.
- Libellé explicite : « J'accepte de recevoir les actualités, conseils et offres de LesNoces par email. Je peux me désinscrire à tout moment. » avec lien vers la politique de confidentialité.
- Aucune case pré-cochée, aucun consentement implicite : sans action, le compte est créé sans consentement.

**Dans l'espace client (Paramètres)**
- Une section « Communications marketing » avec un interrupteur reflétant l'état réel en base.
- Activation : le consentement est enregistré avec sa date.
- Désactivation : fenêtre de confirmation expliquant que le retrait est **définitif** (l'adresse est enregistrée comme opposition et ne sera plus jamais réinscrite dans une liste marketing), puis retrait immédiat de toutes les listes du CRM.

## Comportement métier

- Le consentement est daté et horodaté à chaque octroi, avec la source (inscription ou espace client) pour la preuve RGPD.
- Le retrait crée une **opposition marketing** dans la table existante `oppositions_marketing` (source `compte_client`), exactement comme les désinscriptions remontées par le CRM. Les trois flux sortants existants lisent déjà cette table et cesseront donc d'inscrire l'adresse dans une liste marketing.
- Le retrait déclenche aussi le retrait effectif du contact de toutes les listes marketing du CRM (liste prestataires et toutes les listes `contact_*`) et son placement dans la liste technique des désinscrits, en réutilisant la logique partagée déjà en place.
- Un compte prestataire reste régi par l'intérêt légitime B2B : la case ne s'affiche que pour le rôle marié.
- Cohérence avec l'existant : une opposition étant immuable par conception, un ré-abonnement après retrait n'est pas possible depuis l'interface — le message de confirmation le dit clairement.

## Détails techniques

**Base de données (migration)**
- `public.profiles` : ajout de `consentement_marketing boolean NOT NULL DEFAULT false`, `consentement_marketing_le timestamptz`, `consentement_marketing_source text`.
- `public.handle_new_user()` : lecture de `raw_user_meta_data->>'consentement_marketing'` pour renseigner les trois colonnes à la création du compte (source `inscription`).
- Nouvelle fonction `public.definir_consentement_marketing(p_consent boolean)` en `SECURITY DEFINER`, scopée à `auth.uid()` :
  - `true` → met à jour le profil (date + source `espace_client`) ;
  - `false` → met le profil à `false` et insère l'email dans `oppositions_marketing` (`motif = 'retrait_utilisateur'`, `source = 'compte_client'`), en ignorant le doublon ;
  - dans les deux cas, réveil `pg_net` d'une Edge Function de propagation, dans un bloc protégé pour ne jamais faire échouer l'écriture en base.

**Edge Function `brevo-consentement-marketing`** (`verify_jwt = false`, appelée par le réveil serveur)
- Entrée : `{ profile_id }`. Relit l'état de consentement en base.
- Retrait : réutilise `_shared/brevo-opposition.ts` (`chargerListes`, `estListeMarketing`, `ensureListeDesinscrits`) pour retirer le contact de toutes les listes marketing et poser `CONSENTEMENT_MKT: false`.
- Octroi : met `CONSENTEMENT_MKT: true` sur le contact, sauf si une opposition existe déjà pour cette adresse.
- Journalisation dans `brevo_sync_log` avec un `kind` dédié, sur le même modèle que les synchros existantes.

**Frontend**
- `src/pages/Inscription.tsx` : `Checkbox` shadcn affichée uniquement si `role === "client"`, valeur transmise dans `options.data.consentement_marketing` du `signUp`.
- `src/pages/client/Parametres.tsx` : section consentement, lecture depuis le profil du contexte auth, appel de la RPC avec `.select()`/gestion d'erreur, `AlertDialog` de confirmation pour le retrait, `toast` de résultat.
- `src/contexts/AuthContext.tsx` : rafraîchissement du profil après changement pour que l'interrupteur reflète l'état persistant.

## Vérification
- Inscription mariée sans cocher → profil à `false`, aucune opposition.
- Inscription mariée en cochant → profil à `true` avec date et source `inscription`.
- Retrait depuis l'espace client → profil à `false`, ligne dans `oppositions_marketing`, contact absent de toutes les listes marketing du CRM.
- Une nouvelle demande de devis après retrait ne réinscrit pas l'adresse dans une liste `contact_*`.
