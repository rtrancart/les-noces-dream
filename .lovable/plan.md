# Page /reactivation + Edge Function `request-reactivation-archive`

## 1. Page publique `src/pages/Reactivation.tsx`

Route ajoutée dans `src/App.tsx` (hors `ProtectedRoute`, hors `PublicLayout` pour rester sobre comme `/accept-invitation`) :
```tsx
<Route path="/reactivation" element={<Reactivation />} />
```

Comportement :
- Récupère `pid` depuis l'URL (`useSearchParams`). Fallback : si user connecté, on récupère le `prestataire_id` lié à `user_id`.
- Layout centré, fond champagne, carte blanche, max-w-2xl.
- **Titre** Playfair Display : « Votre profil a été archivé ».
- **Texte** Montserrat : « Le délai de 60 jours pour signer la Charte Qualité LesNoces.net est écoulé. Votre profil a été archivé et n'a pas été publié. La réactivation et la publication de votre profil seront soumises à la validation de l'équipe LesNoces.net. »
- **CTA or** (`bg-[hsl(var(--gold))]` / token `--primary` selon existant) : « Demander la réactivation de mon profil ».
- États gérés via `useState` : `idle | loading | success | error`.
  - `loading` → bouton désactivé + spinner.
  - `success` → remplace CTA par : « Votre demande a bien été transmise. Notre équipe vous recontacte sous 48 heures ouvrées. » (icône check or).
  - `error` → message rouge sobre : « Une erreur est survenue. Contactez-nous à contact@lesnoces.net » + mailto.
- Appel : `supabase.functions.invoke("request-reactivation-archive", { body: { prestataire_id: pid } })`. Si réponse `409` → message spécifique « Une demande a déjà été enregistrée aujourd'hui. ».
- SEO : `<SeoHead>` avec `noindex`.

## 2. Refonte `supabase/functions/request-reactivation-archive/index.ts`

Changements clés :
- **Auth optionnelle** : si pas de header `Authorization`, on accepte mais on exige `prestataire_id` dans le body.
- Si auth présente : on résout le `prestataire_id` via `user_id` (priorité body si fourni et cohérent).
- Vérifications (sinon **422**) :
  - `prestataires.statut = 'archive'`
  - `motif_suspension = 'charte_non_signee'`
- Anti-spam (**409**) : si `demande_reactivation_le >= today 00:00`, refuser.
- Envoi email Scaleway via `send-transactional-email` :
  - `templateName: "demande_reactivation"`
  - `recipientEmail: Deno.env.get("REACTIVATION_TEAM_EMAIL")`
  - `templateData`: `{ nom_commercial, email_prestataire, prestataire_id, lien_backoffice }`
- Update `prestataires.demande_reactivation_le = now()`.
- Codes retour : **200** OK, **409** déjà demandé aujourd'hui, **422** conditions non remplies, **400** payload invalide, **500** erreur interne. CORS sur toutes les réponses.

## 3. Edge Function `sign-charte` — branche `archive_locked`

Avant la résolution de la version active de la charte, si `presta.statut = 'archive'` ET `motif_suspension = 'charte_non_signee'`, retourner :
```
status 423
body { error: "archive_locked", code: "archive_locked", prestataire_id: presta.id }
```
Le front (`SignerLaCharte.tsx`) détecte ce code et redirige : `navigate('/reactivation?pid=' + id)`.

## 4. Template email

Créer `supabase/functions/_shared/transactional-email-templates/demande-reactivation.tsx` (équipe interne), et l'enregistrer dans `registry.ts` sous la clé `demande_reactivation`. Contenu : sujet « [Réactivation] {nom_commercial} demande la republication », corps listant `nom_commercial`, `email_prestataire`, lien back-office.

## 5. Secret

Ajouter `REACTIVATION_TEAM_EMAIL` via `secrets--add_secret` (valeur fournie par l'utilisateur, ex. `equipe@lesnoces.net`). Documenter dans `supabase/functions/request-reactivation-archive/index.ts` en tête de fichier.

## 6. Déploiement

Déployer `request-reactivation-archive` et `sign-charte` après code change.

## Détails techniques

- `supabase/config.toml` : ajouter `[functions.request-reactivation-archive] verify_jwt = false` (auth optionnelle).
- Validation : zod facultatif, mais au minimum vérifier que `prestataire_id` est un UUID valide via regex.
- Pas de migration DB nécessaire (colonnes existent déjà : `demande_reactivation_le`, `demande_reactivation_message`, `motif_suspension`).
- Le template `demande_reactivation_admin` actuel (multi-admins) reste utilisé ailleurs ; on introduit `demande_reactivation` (mail unique équipe) distinct pour ne rien casser.
