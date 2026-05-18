## Objectif

Unifier le parcours de signature de la Charte pour les prestataires qui s'inscrivent seuls avec celui des prestataires invités par magic-link, et retirer toute mention de version visible côté utilisateur.

## Décisions

- **Option A** : `/pro/charte` (tunnel inscription) utilise exactement le même composant et le même processus que `/signer-la-charte` : 6 articles complets parcourus un par un, compte à rebours, checkbox finale, appel à `sign-charte` qui génère le PDF de preuve et insère dans `signatures_charte` (avec IP, user-agent, hash, version).
- **Aucune mention de version** affichée à l'utilisateur (ni "v1.0", ni "v0", ni "version X"). La version reste stockée en base comme preuve juridique mais n'apparaît jamais dans l'UI ni dans les emails côté presta.

## Étapes

### 1. Mutualiser le composant de signature

Extraire le contenu de `SignerLaCharte.tsx` dans un composant réutilisable `<CharteSignatureFlow />` qui gère intro + 6 articles + écran final + appel `sign-charte`. Props :
- `mode: "inscription" | "resignature"` (contrôle texte d'intro et redirection finale)
- `onSigned: () => void`

Les deux pages (`/pro/charte` et `/signer-la-charte`) deviennent de simples wrappers autour de ce composant avec leurs gardes d'accès respectifs.

### 2. Refondre `/pro/charte` (CharteProgressive.tsx)

- Supprimer les 4 écrans courts (Réactivité / Exactitude / Qualité / Sanctions) et le récap.
- Remplacer par `<CharteSignatureFlow mode="inscription" />`.
- Garde d'accès inchangée : prestataire connecté + `cgu_acceptees_le IS NULL`.
- Après signature réussie via `sign-charte`, en plus de ce que fait déjà l'edge function (insert `signatures_charte` + update `charte_signee_le`) :
  - Mettre à jour `profiles.cgu_acceptees_le = NOW()` et `cgu_version_acceptee = <version active>` (lecture interne, jamais affichée).
  - Si la fiche prestataire est en `pre_inscrit`, la passer en `brouillon`.
  - Rediriger vers `/espace-pro?welcome=1`.

### 3. Retirer toutes les mentions de version visibles

À nettoyer :
- `CharteProgressive.tsx` : retirer "Charte Qualité — version v1.0".
- `SignerLaCharte.tsx` (intro) : retirer "Version X — en vigueur depuis le …" (garder éventuellement la date d'entrée en vigueur seule, à confirmer ou retirer aussi).
- `ChartePendingBanner.tsx` : vérifier qu'aucun "version" n'apparaît.
- Templates d'email côté presta (`relance-signature-charte`, `notif-nouvelle-version-charte`, `validation-publication-fiche`, certificat de signature généré par `generate-charte-pdf-preuve`) : audit complet, retirer toute mention de "version X".

Le numéro de version reste écrit en base (`profiles.cgu_version_acceptee`, `signatures_charte.charte_numero_version`, `prestataires.charte_version_signee`) pour la traçabilité juridique, mais n'est jamais rendu à l'écran.

### 4. Tests manuels

- Inscription presta fraîche → redirection `/pro/charte` → parcours 6 articles → signature → PDF reçu par email → presta atterrit sur `/espace-pro` avec bandeau bienvenue, `cgu_acceptees_le` renseigné, signature présente dans `signatures_charte`.
- Magic-link admin → `/signer-la-charte` → parcours identique → mêmes effets.
- Vérifier qu'aucun écran ni email n'affiche le mot "version" + numéro.

## Points techniques

- `sign-charte` existe déjà et fait tout le travail probatoire ; on ne le modifie pas.
- La mise à jour de `profiles.cgu_acceptees_le` se fera côté client après succès de `sign-charte` (déjà le pattern actuel de `CharteProgressive`).
- Le composant mutualisé continue de lire `chartes_versions` pour récupérer le HTML, mais n'affiche plus `numero_version` ni `entree_en_vigueur_le` côté presta.
- Aucune migration DB nécessaire pour cette itération.

## Hors scope

- Refonte de la machine à états `statut_prestataire` (fusion `validee`/`actif`) traitée dans une itération séparée.
- Modifications du flow `AccepterInvitation.tsx` (qui redirige déjà vers `/signer-la-charte`).
