# Retirer l'obligation prénom/nom du contact pour l'invitation prestataire

## Contexte (vérifié)
- L'exigence est **uniquement côté front**, dans `src/pages/admin/Prestataires.tsx` :
  - Validation `handleSendInvitation` (lignes ~688-691) : « Prénom et nom du contact sont obligatoires pour l'invitation. »
  - Libellés des champs : « Prénom contact * » et « Nom contact * » (lignes ~1252-1257).
- Le reste de la chaîne tolère déjà l'absence :
  - Edge function `invite-prestataire` : `user_metadata: { prenom: prenom ?? null, ... }`, mise à jour du profil seulement `if (prenom || nom)`.
  - Email d'invitation : « Bienvenue{prenom ? ` ${prenom}` : ''} » — salutation générique sans prénom.

## Modifications (un seul fichier : `src/pages/admin/Prestataires.tsx`)
1. Supprimer le bloc de validation prénom/nom dans `handleSendInvitation`.
2. Dans le body de l'appel `invite-prestataire`, envoyer `prenom: form.prenom_contact || undefined` et `nom: form.nom_contact || undefined` pour éviter des chaînes vides dans le compte d'authentification.
3. Retirer l'astérisque des libellés : « Prénom contact » et « Nom contact ».

## Non modifié
- Le téléphone, l'email, le nom commercial, la catégorie, la ville et la région restent obligatoires.
- La fonction Edge et les modèles d'email ne changent pas.

## Vérification
- Typecheck.
- Test visuel : ouvrir une fiche en brouillon sans prénom/nom et lancer l'invitation — plus de message d'erreur, email envoyé avec salutation « Bienvenue ».
