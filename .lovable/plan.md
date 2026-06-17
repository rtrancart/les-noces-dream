## Problème

La policy INSERT actuelle sur `storage.objects` pour le bucket `prestataires-photos` autorise tout utilisateur authentifié à uploader dans n'importe quel dossier :

```sql
WITH CHECK (bucket_id = 'prestataires-photos' AND auth.uid() IS NOT NULL)
```

Un prestataire pourrait donc écraser/ajouter des photos dans le dossier d'un autre prestataire.

## Contexte code

Les uploads suivent partout le pattern de chemin `<prestataire_id>/<filename>` :
- `src/pages/prestataire/Galerie.tsx` (le prestataire propriétaire)
- `src/components/admin/PrestatairePhotosTab.tsx` (admin / super_admin gérant un autre prestataire)

## Plan

Migration unique qui remplace la policy INSERT et ajoute les policies UPDATE et DELETE manquantes (actuellement non restreintes côté écriture en dehors de l'INSERT), avec la même règle :

1. `DROP POLICY "Authenticated can upload prestataires photos"`
2. Créer une fonction helper réutilisable `public.can_write_prestataire_photo(path text)` (SECURITY DEFINER, search_path = public), qui retourne `true` si :
   - le premier segment du chemin (`split_part(path, '/', 1)`) correspond à l'`id` d'un `prestataires` dont `user_id = auth.uid()`, **ou**
   - l'appelant a le rôle `admin` ou `super_admin` via `has_role()`.
3. Recréer 3 policies sur `storage.objects` scopées au bucket `prestataires-photos`, rôle `authenticated` :
   - INSERT `WITH CHECK (bucket_id = 'prestataires-photos' AND public.can_write_prestataire_photo(name))`
   - UPDATE `USING (...) WITH CHECK (...)` même condition
   - DELETE `USING (...)` même condition

La policy SELECT publique existante reste inchangée (bucket public en lecture).

## Vérification

- Tester via l'app : un prestataire connecté upload dans son dossier → OK ; tentative dans un autre dossier → refusée.
- Onglet admin photos : admin peut toujours uploader / supprimer pour n'importe quel prestataire.
- Re-run scanner pour fermer `prestataires_photos_unrestricted_upload`.
