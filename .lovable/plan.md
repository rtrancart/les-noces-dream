# Confirmation d'email : message clair au lieu d'une erreur

## Diagnostic (journaux d'authentification de ce soir)
- 23h05:37 : le premier clic sur le lien a fonctionné. Le compte rodolphe.trancart+testinscription@gmail.com est confirmé et connecté.
- 23h05:48 puis 23h08:14 : deux autres clics sur le même lien. Il ne sert qu'une fois, donc le site renvoie « lien invalide ou expiré ».
- 23h06:00 : connexion par mot de passe réussie, donc le compte fonctionne.

Le lien marche bien. Le vrai problème : après le premier clic, le visiteur arrive sur l'accueil sans aucun message. Il ne sait pas que c'est confirmé, reclique, et tombe sur l'erreur affichée dans l'adresse.

## Ce qui change
1. Après une confirmation réussie : message « Votre email est confirmé, bienvenue ! », puis envoi vers l'espace marié (/mon-compte).
2. Si le lien a déjà servi ou a expiré : on n'affiche plus l'erreur brute dans l'adresse, mais un message clair :
   - si la personne est déjà connectée : « Votre email est déjà confirmé. »
   - sinon : « Ce lien a déjà été utilisé ou a expiré. Si vous avez déjà confirmé, connectez-vous. Sinon, demandez un nouveau lien. » Avec un bouton vers la page de connexion.
3. On efface la partie `#error=...` de l'adresse affichée.

Rien ne change pour l'email, sa durée de validité, la connexion, le mot de passe oublié ou les liens des prestataires migrés.

## Tests sur l'aperçu
- Nouvelle inscription, premier clic : message de bienvenue et arrivée dans l'espace marié.
- Deuxième clic sur le même lien : message « déjà utilisé », plus d'erreur brute.
- Lien de prestataire migré et mot de passe oublié : toujours OK.

## Détails techniques
- Un petit composant placé une seule fois dans l'application lit `window.location.hash` au chargement : `error_code=otp_expired` ou `access_denied`, ou bien `type=signup` avec une session.
- Il affiche un toast, nettoie le hash avec `history.replaceState`, et redirige après une confirmation réussie.
- Ne pas toucher aux hashes `type=recovery` / `magiclink` déjà gérés par ResetPassword et AccepterInvitation.
