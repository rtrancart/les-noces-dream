# Ajouter l’onglet Photos à la création d’un prestataire

## Comportement attendu

- Afficher l’onglet **Photos** dans la fenêtre de création, au même emplacement que dans la modification.
- Permettre d’ajouter plusieurs images par le bouton existant ou par glisser-déposer avant même que la fiche soit enregistrée.
- Afficher immédiatement les vignettes sélectionnées, avec la première image marquée comme principale.
- Permettre de réordonner, choisir la photo principale ou retirer une image avant l’enregistrement.
- Lors de « Sauvegarder et continuer plus tard » ou « Sauvegarder et envoyer l’invitation », créer d’abord la fiche, puis envoyer les photos et enregistrer leur ordre.
- En cas d’échec d’une photo, conserver la fiche créée et afficher clairement l’erreur ; ne jamais annoncer un succès d’envoi si l’enregistrement des photos a échoué.

## Détails techniques

- Faire évoluer le composant de galerie admin pour accepter soit un prestataire existant, soit une liste locale de fichiers en attente.
- En mode création, produire des aperçus locaux et libérer leurs URLs temporaires à la fermeture de la fenêtre.
- Après création, réutiliser les mêmes contrôles et le même stockage que dans la modification : images uniquement, 5 Mo maximum par fichier, première URL en photo principale, suivantes dans la galerie.
- Adapter les deux parcours de création : sauvegarde simple et création avec invitation.
- Laisser inchangés le formulaire de modification, les statuts, les règles d’invitation et la fiche publique.

## Vérification

- Tester la création avec plusieurs photos, leur réordonnancement et leur suppression avant sauvegarde.
- Vérifier que la première photo devient bien la principale après création.
- Vérifier le parcours « sauvegarder et envoyer l’invitation » avec photos.
- Vérifier que la modification d’un prestataire existant continue de fonctionner comme aujourd’hui.
