# Wording bannière Charte pour prestataires migrés

## Objectif
Adapter le message du bandeau Charte affiché aux prestataires migrés qui arrivent sur leur espace pro via le lien email sans avoir signé la Charte Qualité.

## Constats
- Le bandeau est géré par `src/components/prestataire/ChartePendingBanner.tsx`.
- Il distingue déjà la "première signature" (`isFirstSignature`) de la "resignature".
- Le wording actuel pour la première signature contient une faute de frappe : "Signez la Charte Qualité rendre votre profil visible sur LesNoces.net" (manque "pour").
- La colonne `origine` existe sur `prestataires` (enum `origine_prestataire`), donc le contexte prestataire expose cette information.

## Modification prévue
Dans `src/components/prestataire/ChartePendingBanner.tsx` :

1. Lire `prestataire.origine` depuis le contexte.
2. Lorsque `isFirstSignature` est vrai **et** `prestataire.origine === 'migration'`, afficher :
   - Titre : "Votre fiche n'est pas encore publiée." (inchangé)
   - Sous-titre : "Signez la Charte Qualité pour rester visible sur LesNoces.net"
3. Pour les autres premières signatures (non migrés), corriger le sous-titre en : "Signez la Charte Qualité pour rendre votre profil visible sur LesNoces.net"
4. Laisser le cas resignature inchangé.

## Vérification
- `npx tsgo --noEmit` pour valider le typage.
- Aucune modification de base de données, d'API ou d'autres pages requise.
