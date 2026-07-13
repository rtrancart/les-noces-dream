
## Objectif

Charger dans `email_textes` un contenu personnalisé (`sujet` + `corps_html`) pour les 11 templates transactionnels du registre, adoptant le design system fourni. Les templates React Email en code restent en place comme filet de sécurité — le `Reset au défaut` du back-office continue de fonctionner.

Les emails d'authentification restent en code (hors périmètre), mais leurs logos base64 seront eux aussi remplacés par les URL hébergées, pour cohérence.

## Étape 1 — Héberger les logos dans Storage

Bucket public `email-assets` (déjà existant). Extraire les 3 base64 présents dans la maquette et les uploader :

| Fichier bucket | Source dans la maquette | Usage |
|---|---|---|
| `logo-ring-abysse.png` | `LOGO_RING_ABYSSE` | Header (fond champagne) |
| `logo-wordmark-white.png` | `LOGO_WORDMARK_WHITE` | Footer (fond abysse) |
| `logo-wordmark-abysse.png` | `LOGO_WORDMARK_ABYSSE` | Signature Nathalie / équipe |

Les URL publiques Storage seront centralisées dans une constante partagée `supabase/functions/_shared/transactional-email-templates/brand-assets.ts` pour réutilisation par les templates React Email et par l'auth hook.

**Point d'attention signalé** : la maquette référence dans son export HTML un fichier `logo-ring-gold.png` (ring doré) que le fichier ne fournit pas en base64 — seule la version abysse foncée est encodée. J'utiliserai `logo-ring-abysse.png` sur fond champagne (contraste correct) sauf indication contraire de ta part. Le petit rond "N" de signature reste rendu en HTML/CSS pur (cercle doré + lettre) — pas d'image nécessaire.

## Étape 2 — Traducteur maquette → HTML email-safe

Créer un utilitaire Deno `supabase/functions/admin-email-textes/build-designed-html.ts` qui produit, pour chaque template, un HTML :
- Structure 100% `<table role="presentation">`, largeur fixe 600 px, styles inline uniquement
- Compatible Outlook (pas de flex/grid, `mso-` conditionnels si nécessaire)
- Header champagne + navigation + footer abysse identiques à la maquette
- Signature Nathalie ou Équipe selon le template
- Palette : `#A57D27` (or), `#C9AF78` (champagne), `#2D4356` (pétrole), `#0F141E` (abysse), `#FAFAFA`, `#7A7A7A`
- Typos : `'Playfair Display', Georgia, serif` (titres) / `Montserrat, Arial, sans-serif` (corps), avec fallbacks web-safe
- Bloc renderers pour : `eyebrow`, `h`, `p`, `btn`, `info`, `note`, `warn`, `ul`, `small`, `quote`, `stats` — les mêmes primitives que la maquette

Ce fichier n'est utilisé qu'au **moment du chargement** en base (via une action `seed_designed` de l'edge function admin). Ce n'est pas un renderer runtime.

## Étape 3 — Correspondances template ↔ maquette

Templates avec maquette dédiée (reprise 1:1, variables du `previewData` substituées aux valeurs d'exemple) :

| Template registre | Maquette source | Signataire |
|---|---|---|
| `invitation_prestataire` | A-01 « Email de découverte » | Nathalie |
| `validation_publication_fiche` | P-07 « Fiche publiée » | Nathalie |
| `notif_nouveau_contact_presta` | P-14 « Nouveau contact — client avec compte » | Équipe |
| `notif_nouveau_contact_presta_sans_compte` | P-15 « Nouveau contact — client sans compte » | Équipe |
| `notif_reponse_client_avec_compte` | C-07 « Notification réponse prestataire » | (aucune) |
| `notif_reponse_client_sans_compte` | C-07 variante magic link | (aucune) |
| `notif_reponse_presta` | Miroir de C-07 (côté prestataire) | (aucune) |

Templates sans maquette dédiée — design system appliqué avec le contenu actuel du template React Email (header, footer, typo, palette, boutons, blocs `info/note/warn` identiques) :

- `relance_signature_charte` (relance signature charte au prestataire) — signataire Nathalie
- `notif_nouvelle_soumission_fiche` (interne équipe : nouvelle fiche à examiner) — sans signature
- `notif_nouvelle_version_charte` (nouvelle version charte publiée aux prestataires) — équipe
- `demande_reactivation` (interne équipe : demande de réactivation) — sans signature

**Ambiguïté signalée** : `notif_reponse_presta` n'a pas de maquette explicite ; C-07 est côté marié. Je reprends la même structure (bloc `eyebrow` + `h` + extrait + CTA « Répondre dans ma messagerie ») mais adaptée au contexte prestataire. Dis-moi si tu veux une maquette dédiée à la place.

## Étape 4 — Substitution des variables

Pour chaque template, remplacer les valeurs d'exemple de la maquette (`{{nom_prestataire}}` déjà présent, mais aussi les chiffres/dates codées en dur type « J-30 », « 683 vues ») par les vraies variables déclarées dans le `previewData` du template React Email correspondant. Contrôle : aucune valeur d'exemple codée en dur ne subsiste dans le HTML chargé — uniquement des `{{var}}` connues du registre.

## Étape 5 — Chargement en base

Ajouter à `admin-email-textes` une action `seed_designed` (idempotente) qui, pour chaque template du registre :
1. Génère `sujet` (celui de la maquette quand elle existe, sinon celui du code) et `corps_html` designé.
2. Upsert dans `email_textes` avec `est_actif = true`, `variables_disponibles` recalculées depuis `previewData`.
3. Journalise la liste des templates chargés/mis à jour.

Le bouton « Réinitialiser au défaut » du back-office continue à ramener au HTML issu du code React Email (comportement inchangé).

## Étape 6 — Auth hook : remplacer les logos base64

Dans les 6 templates React Email de `supabase/functions/_shared/email-templates/*.tsx`, remplacer toute image base64 ou lien local par les URL Storage centralisées (via `brand-assets.ts`). Aucun changement de contenu ou de logique.

## Étape 7 — Vérification

1. Uploader les 3 PNG dans `email-assets`.
2. Déployer les edge functions `admin-email-textes` et `auth-email-hook`.
3. Depuis l'admin back-office `/admin/emails`, cliquer « Aperçu » sur chaque template transactionnel → confirmer : logo header visible, footer visible, aucune valeur d'exemple, variables `{{...}}` correctement affichées.
4. Toggle « Personnalisation active » puis « Réinitialiser au défaut » sur un template → doit ramener au rendu React Email d'origine (filet de sécurité opérationnel).
5. Envoyer un email test (par ex. déclencher un `notify-nouveau-contact-presta`) → confirmer la réception avec le nouveau design et les logos hébergés.

## Fichiers touchés

- `supabase/functions/_shared/transactional-email-templates/brand-assets.ts` (nouveau) — URL des logos hébergés
- `supabase/functions/admin-email-textes/build-designed-html.ts` (nouveau) — moteur de rendu design→HTML email-safe
- `supabase/functions/admin-email-textes/index.ts` — ajout de l'action `seed_designed`
- `supabase/functions/_shared/email-templates/*.tsx` (6 fichiers auth) — remplacer les images base64 par les URL Storage
- Upload Storage : `logo-ring-abysse.png`, `logo-wordmark-white.png`, `logo-wordmark-abysse.png` dans `email-assets`
- Déclencheur manuel de l'action `seed_designed` (ou bouton dans `/admin/emails`) — au choix
