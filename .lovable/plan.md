

## Fiche prestataire — Avis clients

### Rappel des règles
- Seuls les avis avec `statut = 'valide'` sont affichés publiquement (c'est déjà le cas dans la RLS et le code existant)
- Un bouton "Laisser un avis" permet à un visiteur de noter le prestataire
- Avant d'afficher le formulaire, on vérifie par email que le visiteur a bien envoyé au moins une demande de devis à ce prestataire

### Fonctionnement du bouton "Laisser un avis"

1. L'utilisateur clique sur "Laisser un avis"
2. Premier écran : saisie de l'adresse email
3. Requête vers `demandes_devis` : on cherche une ligne avec `email_contact = email saisi` ET `prestataire_id = prestataire courant`
4. Si aucune correspondance : message d'erreur "Vous devez avoir contacté ce prestataire via une demande de devis pour pouvoir laisser un avis"
5. Si correspondance trouvée : on affiche le formulaire de notation

### Formulaire d'avis (tous les champs obligatoires)
- 4 notes sur 5 (étoiles cliquables) : Qualité de prestation, Professionnalisme, Rapport qualité/prix, Flexibilité
- Commentaire libre (textarea, min 20 caractères)
- La `note_globale` est calculée automatiquement avec la pondération existante
- Insert dans `avis` avec `statut = 'en_attente'`, `prestataire_id`, `contact_id` (depuis la demande trouvée), `email` du contact
- Toast de confirmation : "Merci ! Votre avis sera publié après validation"

### Fichiers à créer / modifier

1. **`src/components/fiche/FicheAvisForm.tsx`** (nouveau)
   - Dialog/Sheet avec deux étapes : vérification email puis formulaire
   - Composant de notation par étoiles interactif
   - Validation Zod (4 notes 1-5 obligatoires, commentaire min 20 chars)
   - Vérification email via query `demandes_devis`
   - Insert dans `avis`

2. **`src/components/fiche/FicheAvis.tsx`** (nouveau — partie de la fiche publique)
   - Résumé global : note moyenne + barres de progression par critère
   - Liste des avis `valide` avec : note globale (étoiles), détail 4 sous-notes, commentaire, date, réponse prestataire
   - Bouton "Laisser un avis" qui ouvre `FicheAvisForm`

3. **`src/pages/FichePrestataire.tsx`** (nouveau — intègre FicheAvis)

### Sécurité
- La RLS existante autorise déjà l'insertion d'avis pour les utilisateurs authentifiés (`auth.uid() IS NOT NULL`)
- Pour permettre aussi aux visiteurs non connectés de laisser un avis (via email), il faudra soit rendre la policy INSERT plus permissive (`true`), soit passer par une edge function
- Option retenue : on garde la contrainte d'authentification. Le visiteur doit être connecté pour laisser un avis. On vérifie ensuite par email qu'il a bien fait une demande de devis

### Points techniques
- La vérification email se fait côté client via une query SELECT sur `demandes_devis` filtrée par `email_contact` et `prestataire_id`. La RLS permet ce SELECT si le profil connecté correspond au `profile_id` de la demande — il faudra donc vérifier que l'email du profil connecté correspond, ou utiliser une RPC/edge function pour cette vérification
- Alternative plus simple : vérifier que `auth.uid()` a un profil dont l'email correspond à un `email_contact` dans `demandes_devis` pour ce prestataire. Cela se fait via une database function `SECURITY DEFINER` qui retourne un booléen, appelée depuis le client

### Migration SQL nécessaire
- Créer une fonction `can_review_prestataire(p_prestataire_id uuid)` qui vérifie si l'utilisateur connecté (via `auth.uid()` -> `profiles.email`) a au moins une demande de devis pour ce prestataire

