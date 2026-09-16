# Envoyer des invitations aux prestataires en brouillon

## Diagnostic (confirmé)

- Dans la fiche d'édition admin (`src/pages/admin/Prestataires.tsx`), le bouton d'invitation n'apparaît que pour les fiches d'origine « migration » (« Inviter — campagne migration 60 j »). Pour toutes les autres fiches existantes (brouillon, pré-inscrit…), aucun bouton.
- Le bouton « Sauvegarder et envoyer l'invitation » n'existe qu'à la création d'une nouvelle fiche.
- Côté serveur, la fonction d'invitation accepte déjà les fiches en brouillon : elle les fait passer en « pré-inscrit » et envoie le magic link (valide 7 jours). Aucun changement serveur nécessaire.

## Solution proposée

Ajouter un bouton **« Envoyer l'invitation »** dans la fiche d'édition d'un prestataire existant, visible lorsque :

- la fiche n'est **pas** d'origine migration (celles-ci gardent leur bouton 60 j dédié) ;
- et le statut est **brouillon** ou **pré-inscrit** (pas de bouton pour les fiches déjà actives, suspendues ou archivées).

Comportement du bouton :

- réutilise exactement le même envoi que le bouton de création (lien valide 7 jours, passage en pré-inscrit, email d'invitation) ;
- mêmes contrôles qu'aujourd'hui : email, nom commercial, catégorie, ville, région, téléphone, prénom et nom du contact obligatoires — une boîte de confirmation récapitule l'envoi avant départ ;
- le formulaire est sauvegardé au passage, comme à la création.

## Conséquence pour vos 9 fiches de test

Le formulaire exige téléphone + prénom/nom du contact. Ces champs sont vides sur les fiches créées hier : il faudra les renseigner dans la fiche avant l'envoi (le bouton refusera sinon, avec un message clair).

## Détails techniques

- Fichier modifié : `src/pages/admin/Prestataires.tsx` uniquement (pied de la boîte de dialogue d'édition, lignes ~1478-1482).
- Aucune migration, aucune modification de l'Edge Function `invite-prestataire`, aucun changement pour les fiches migrées ou le tunnel A.
