## Diagnostic

La suppression lancée depuis `/admin/prestataires` ne passe pas par la fonction sécurisée `admin-delete-user`. Elle exécute encore une suppression directe sur la table `prestataires`, ce qui déclenche la suppression en cascade de `signatures_charte` sans activer le bypass prévu. Le trigger bloque donc toujours avec : “Les signatures sont immuables…”.

## Plan d’implémentation

1. Modifier `src/pages/admin/Prestataires.tsx`
   - Remplacer la suppression directe `supabase.from("prestataires").delete()` par l’appel à `admin-delete-user` quand le prestataire est lié à un compte utilisateur (`user_id`).
   - Conserver une suppression directe uniquement pour les fiches sans compte utilisateur associé, si elles existent.
   - Afficher un message d’erreur clair si la fiche n’a pas les données nécessaires.

2. Sécuriser l’affichage/action
   - Vérifier que la liste récupère bien `user_id` pour chaque prestataire.
   - Adapter le handler de suppression pour recevoir l’objet prestataire plutôt que seulement son `id`.

3. Valider
   - Vérifier que le code appelle bien la fonction `admin-delete-user` depuis la page prestataires.
   - La suppression d’un prestataire avec charte signée passera alors par le RPC `admin_delete_user_cascade`, donc le trigger d’immutabilité ne bloquera plus.