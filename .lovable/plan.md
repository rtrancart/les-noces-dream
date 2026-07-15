## Objectif

Ajouter un champ **Titre de l'avis** dans le formulaire de dépôt d'avis et le propager jusqu'à la colonne `avis.titre` (déjà existante en base, aujourd'hui non alimentée).

## 1. Formulaire `src/components/fiche/FicheAvisForm.tsx`

- Ajouter `titre: z.string().trim().min(3, "Titre requis").max(120, "Maximum 120 caractères")` dans le schéma zod.
- Ajouter le champ `titre` dans `defaultValues` (`""`).
- Insérer un `<FormField name="titre">` en tête du formulaire (avant les 4 notes), avec un `<Input placeholder="Résumez votre expérience en quelques mots" />`.
- Passer `p_titre: values.titre` dans l'appel `supabase.rpc("soumettre_avis", …)`.

## 2. Fonction SQL `public.soumettre_avis`

Ajouter un paramètre `p_titre text` (positionné après `p_commentaire`, avant `p_nom`/`p_email` pour garder les paramètres optionnels à la fin, ou à la fin selon la signature — à valider) :

- Trim + validation : `length(trim(p_titre)) BETWEEN 3 AND 120`, sinon `RAISE EXCEPTION 'Titre requis (3 à 120 caractères)'`.
- Insérer la valeur dans `avis.titre` lors du `INSERT`.

Migration SQL : `CREATE OR REPLACE FUNCTION public.soumettre_avis(...)` avec la nouvelle signature, `GRANT EXECUTE ... TO anon, authenticated` re-donné pour la nouvelle signature. L'ancienne signature (sans `p_titre`) sera droppée dans la même migration pour éviter la coexistence.

## 3. Affichage

`FicheAvis.tsx` et `pages/prestataire/Avis.tsx` affichent déjà `a.titre` quand il est présent — aucun changement.

## Fichiers touchés

- `src/components/fiche/FicheAvisForm.tsx` — schéma + champ + appel RPC.
- Migration SQL : `DROP FUNCTION public.soumettre_avis(uuid, smallint, smallint, smallint, smallint, text, text, text)` + `CREATE OR REPLACE FUNCTION public.soumettre_avis(..., p_titre text, ...)` + `GRANT EXECUTE`.
