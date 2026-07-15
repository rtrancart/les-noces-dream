## Objectif

Assouplir le dépôt d'avis : plus de minimum 100 caractères, et plus besoin d'être connecté (le prestataire peut avoir tout géré par téléphone avec un client qui n'a pas de compte). La modération admin reste le seul filtre anti-faux avis.

## 1. Formulaire d'avis (`src/components/fiche/FicheAvisForm.tsx`)

- **Retirer la contrainte 100 caractères** dans le schéma zod : `commentaire: z.string().trim().min(1, "Obligatoire").max(2000)`.
- Adapter le placeholder du textarea ("Décrivez votre expérience…" sans mention "min. 100").
- **Rendre le formulaire accessible aux visiteurs non connectés** :
  - Ajouter en tête du formulaire deux champs obligatoires si `!user` :
    - `nom` (2–80 caractères)
    - `email` (format email, max 255)
    - Ces champs alimenteront `contacts_anonymes` (mécanisme déjà utilisé pour les demandes de devis) via une nouvelle fonction SQL `soumettre_avis` (voir §3), pour associer l'avis à un `contact_id` plutôt qu'à un `client_id`.
  - Si `user` connecté : champs masqués, on garde le lien via `client_id = auth.uid()`.
- Bouton "Laisser un avis" sur la fiche (`FicheAvis.tsx`) : retirer la condition qui exige d'être connecté (rendre visible pour tous). Aucun autre changement UI nécessaire.

## 2. RLS de la table `public.avis`

Remplacer la policy `Clients can submit reviews (pending moderation)` par un dispositif qui autorise deux cas :

- **Utilisateur connecté** : `client_id = auth.uid()`, `contact_id IS NULL`, pas d'auto-avis, un seul avis par couple (client, prestataire).
- **Visiteur anonyme** : insertion refusée par RLS directe. Le dépôt anonyme passera obligatoirement par la fonction `soumettre_avis` en `SECURITY DEFINER` (§3), qui contrôle elle-même les règles métier. Aucune policy INSERT pour `anon` sur `avis` (surface d'attaque minimisée).

Dans tous les cas la policy force `statut = 'en_attente'`.

## 3. Nouvelle fonction SQL `soumettre_avis`

`SECURITY DEFINER`, `search_path = public`, appelée depuis le formulaire quel que soit l'état de connexion. Elle :

- valide les 4 notes (1..5) et le commentaire non vide,
- si `auth.uid()` existe → `client_id = auth.uid()`, ignore `p_nom`/`p_email`,
- sinon → crée/retrouve un `contacts_anonymes` (email normalisé) et attache `contact_id`,
- interdit l'auto-avis (prestataire appartenant à l'utilisateur connecté),
- anti-doublon : une seule ligne `avis` par couple (`client_id`|`contact_id`, `prestataire_id`),
- calcule `note_globale` pondérée `(Q*2 + P + R + F)/5`,
- insère `statut = 'en_attente'`.

`GRANT EXECUTE ON FUNCTION public.soumettre_avis(...) TO anon, authenticated;`

## 4. Modération admin

Aucun changement : `/admin/avis` continue de valider/rejeter. Le trigger `sync_note_prestataire` publie l'avis (`statut = 'valide'`) et recalcule la note.

## 5. Points de vigilance sécurité

- Anti-spam : l'anonymat rouvre la porte aux faux avis. Mitigations en place :
  - **Modération admin obligatoire** (statut `en_attente` forcé).
  - **Anti-doublon** par email/prestataire dans `soumettre_avis`.
  - Validation côté client + côté SQL des notes et de la longueur du commentaire (max 2000).
- Optionnel (non inclus, à confirmer si vous voulez plus tard) : rate-limit par IP, captcha, ou email de confirmation avant modération.

## Fichiers touchés

- `src/components/fiche/FicheAvisForm.tsx` — schéma zod, champs nom/email conditionnels, appel `supabase.rpc('soumettre_avis', …)` au lieu de `insert`.
- `src/components/fiche/FicheAvis.tsx` — bouton "Laisser un avis" toujours visible.
- Migration SQL : nouvelle policy RLS sur `avis` + fonction `soumettre_avis` + GRANT.
