## Problème

La policy SELECT sur `public.profiles` est `USING (true)` → tout visiteur anonyme peut lire les emails, téléphones, dates de naissance et préférences de notification de tous les utilisateurs.

## Approche

Restreindre la SELECT à `auth.uid() = id` (+ admins), et créer une vue publique `profiles_public` exposant uniquement `id, prenom, nom` pour le seul usage public restant (nom d'auteur d'article de blog sur la page d'accueil).

## Migration

1. `DROP POLICY "Profiles are viewable by everyone" ON public.profiles;`
2. Créer deux nouvelles policies SELECT sur `profiles` :
   - `"Users can view own profile"` — `USING (auth.uid() = id)`
   - `"Admins can view all profiles"` — `USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))`
   → les écrans admin (useUsersData, EditUserDialog, admin/Dashboard, admin/Prestataires, admin/Logs) continuent d'interroger `.from("profiles")` et reçoivent toutes les colonnes (email, téléphone, etc.) grâce à cette policy dédiée.
3. Créer la vue :
   ```sql
   CREATE OR REPLACE VIEW public.profiles_public AS
     SELECT id, prenom, nom FROM public.profiles;
   GRANT SELECT ON public.profiles_public TO anon, authenticated;
   ```
   security_invoker laissé implicite (OFF) : sans risque ici puisque la vue ne sélectionne que `id, prenom, nom` — aucun champ sensible n'est exposable même si elle bypass la RLS de la table sous-jacente.

## Refactor code

Un seul call-site public à migrer :
- `src/pages/Index.tsx` (l. 147) — récupération des noms d'auteurs d'articles : `.from("profiles")` → `.from("profiles_public")`.

Les autres call-sites sont owner (AuthContext, CharteProgressive, AccepterInvitation) ou admin (useUsersData, EditUserDialog, admin/Dashboard, admin/Prestataires, admin/Logs) — inchangés, ils passent par les policies owner/admin.

## Vérification

- Build TS OK après régénération des types.
- Page d'accueil affiche toujours les noms d'auteurs en anonyme.
- Mon profil et écrans admin (liste utilisateurs, édition, logs) inchangés et toujours alimentés en email/téléphone/etc.
- Re-run scanner : `profiles_public_exposure` doit se fermer.
