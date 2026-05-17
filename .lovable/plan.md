# Plan : Unification du flow prestataire

Refonte majeure : un seul chemin de création (brouillon ou invitation), modale unique, parcours post-signature avec soumission pour validation.

## 1. Base de données (migration)

- **Cleanup** : DELETE des 12 `chartes_versions` de test (T-e2e-*) + insertion d'une vraie version active "v1.0".
- **Enum `statut_prestataire`** : vérifier que `brouillon`, `pre_inscrit`, `en_attente`, `a_corriger`, `validee`, `actif`, `suspendu`, `archive` existent. Ajouter `a_corriger` si absent.
- **Trigger `prevent_brouillon_public`** : RLS déjà ok (statut = 'actif' uniquement public). Rien à ajouter.
- **Cleanup test data** : modifier `index_test.ts` pour DELETE aussi les `chartes_versions` en cleanup.
- **Templates email** : INSERT dans `email_textes` les deux nouveaux templates (`notif_nouvelle_soumission_fiche`, `validation_publication_fiche`).

## 2. Frontend admin

### Fichiers à supprimer
- `src/pages/admin/PrestatairesPreInscrits.tsx`

### Fichiers à modifier
- `src/App.tsx` : retirer route `/admin/prestataires-pre-inscrits`, ajouter redirect → `/admin/prestataires`.
- `src/components/admin/AdminSidebar.tsx` : retirer entrée "Pré-inscrits".
- `src/pages/admin/Prestataires.tsx` : refonte complète
  - KPI cards cliquables (tous + chaque statut)
  - Filtres rapides en haut
  - Bouton unique "Créer un prestataire"
  - Colonnes toggleables (premier_login_le, magic_link_envoye_le, magic_link_ouvert, jours_depuis_invitation, charte_signee_le)
  - Actions contextuelles par statut
  - Clic sur ligne brouillon → rouvre modale

### Nouveau composant
- `src/components/admin/PrestataireFormDialog.tsx` : modale unifiée
  - Champs obligatoires + facultatifs
  - Upload photos (bucket `prestataires-photos`)
  - 3 actions : croix (annuler avec confirm si dirty), "Sauvegarder et continuer plus tard" (brouillon, pas d'email), "Sauvegarder et envoyer l'invitation" (avec confirm modal)
  - Mode édition : pré-rempli depuis prestataire existant

## 3. Frontend prestataire (parcours post-signature)

### Modifications
- `src/pages/SignerLaCharte.tsx` : après signature, rediriger vers `/espace-pro` (déjà le cas probablement).
- `src/components/prestataire/PrestataireLayout.tsx` ou Dashboard : ajouter bandeau d'accueil inspirationnel si `statut = pre_inscrit` ET charte signée.
- `src/pages/prestataire/Profil.tsx` ou `Prestation.tsx` : bouton "Soumettre pour validation" actif quand champs obligatoires remplis (zones_intervention, champs spécifiques, prix, photo principale). Au clic : UPDATE statut → en_attente + invoke edge function `notify-nouvelle-soumission`.

### Garde charte (déjà demandée par message précédent — confirmation)
- Créer `src/components/auth/ChartePendingGuard.tsx` : wrapper qui redirige tout prestataire connecté sans charte signée vers `/signer-la-charte` (sauf si déjà sur `/signer-la-charte`, `/deconnexion`, `/cgu`).
- L'appliquer dans `App.tsx` au niveau `AuthProvider`.

## 4. Edge Functions

### Nouvelle
- `supabase/functions/notify-nouvelle-soumission/index.ts` : envoie l'email `notif_nouvelle_soumission_fiche` à tous les admins + crée notification in-app.

### Modifiée
- `supabase/functions/invite-prestataire/index.ts` : accepter prestataire existant (brouillon → pre_inscrit) en plus de création.

## 5. Tests E2E

- Mettre à jour `supabase/functions/sign-charte/index_test.ts` :
  - cleanup `chartes_versions` dans `cleanup()`
  - ajouter test : brouillon → pre_inscrit → invite → signature → completion → en_attente → validee → actif

## Sections techniques

### Champs obligatoires modale création
email, prenom, nom (du contact → profile), nom_commercial, categorie_mere_id, categorie_fille_id, ville, region, telephone

### Champs obligatoires soumission validation (côté prestataire)
Tout ce qui précède + zones_intervention non vide, photo_principale_url, prix_depart, description.

### Récap cycle de vie
`brouillon` (admin) → `pre_inscrit` (invitation) → [magic link + signature + complétion] → `en_attente` (soumission) → `validee` (admin) → `actif` (auto via trigger) → [suspendu/archive]

## Hors-scope de ce ticket
- Pas de refonte complète du Dashboard prestataire (juste le bandeau).
- Pas de "démonstration messagerie" ni "découverte autres prestataires" dans cette itération (placeholder uniquement).
- Pas de modification du Stripe trial (déclenchement à la publication actif sera traité ailleurs).

Confirme et je commence l'implémentation.
