## Contexte

Faille confirmée : la policy RLS INSERT sur `avis` accepte n'importe quel utilisateur connecté (`auth.uid() IS NOT NULL`), sans lien avec le prestataire. Un attaquant peut donc, en tapant directement l'API :
- poster un avis au nom de quelqu'un d'autre (`client_id` arbitraire),
- publier plusieurs avis pour le même prestataire,
- forcer `statut = 'valide'` et court-circuiter la modération admin.

Le contrôle par email dans `FicheAvisForm.tsx` reste utile côté UX mais ne protège rien côté base.

## Décision produit

Vu que beaucoup de prestations se règlent hors plateforme (téléphone), on n'exige PAS de `demande_devis` préalable. On garde une porte ouverte pour tout client connecté, mais on referme les vraies portes dérobées :

- L'avis est forcément posté au nom du user connecté.
- L'avis part obligatoirement en `en_attente` (la modération admin existante reste le vrai filtre anti-faux avis).
- Un seul avis par couple (client, prestataire) — plus de spam.
- Un client ne peut pas poster d'avis sur son propre prestataire.

## Plan

### 1. Migration RLS sur `public.avis`

- Supprimer la policy `Authenticated can insert avis`.
- Créer une nouvelle policy INSERT durcie (voir SQL en "Détails techniques").
- Policy admin `Admins can manage avis` (FOR ALL) : inchangée → super_admin/admin gardent les pleins pouvoirs (modération, réponses, corrections).
- Policy SELECT publique : inchangée → affichage des avis validés inchangé.

### 2. Nettoyage côté UI (`src/components/fiche/FicheAvisForm.tsx`)

- Retirer l'appel `can_review_prestataire` et l'étape "email" du flux client normal, puisque la règle métier ne l'exige plus. On garde le formulaire direct : notes + commentaire ≥ 100 caractères, `client_id = user.id`, `statut = 'en_attente'`.
- Le cas super_admin (`isSuperAdmin` → step form direct) reste inchangé.
- Optionnel mais recommandé : supprimer la fonction SQL `can_review_prestataire` devenue inutile (peut être fait dans la même migration ou plus tard).

### 3. Vérifications

- Test manuel : un client connecté peut poster un avis → OK, arrive en `en_attente`.
- Deuxième tentative sur le même prestataire → refusée par la policy.
- Tentative de forcer `statut = 'valide'` ou un `client_id` étranger via l'API → refusée.
- Relancer le scanner Supabase pour clore le finding.

## Détails techniques

```sql
DROP POLICY "Authenticated can insert avis" ON public.avis;

CREATE POLICY "Clients can submit reviews (pending moderation)"
ON public.avis
FOR INSERT
TO authenticated
WITH CHECK (
  client_id = auth.uid()
  AND statut = 'en_attente'
  -- pas d'auto-avis
  AND NOT EXISTS (
    SELECT 1 FROM public.prestataires p
    WHERE p.id = avis.prestataire_id
      AND p.user_id = auth.uid()
  )
  -- un seul avis par couple client/prestataire
  AND NOT EXISTS (
    SELECT 1 FROM public.avis a
    WHERE a.client_id = auth.uid()
      AND a.prestataire_id = avis.prestataire_id
  )
);
```

La modération admin (statut `valide` / `rejete`) reste couverte par la policy `Admins can manage avis` déjà en place. Le trigger `sync_note_prestataire` ne recalcule les notes que pour les avis `statut = 'valide'` → un avis en attente n'impacte pas la note publique tant qu'il n'est pas modéré.
