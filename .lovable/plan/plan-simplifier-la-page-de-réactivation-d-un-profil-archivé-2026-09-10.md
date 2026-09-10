Plan : simplifier la page de réactivation d'un profil archivé

Objectif
--------
Transformer la page `/reactivation` en une page d'information simple, sans mention de la Charte Qualité ni de délai de 60 jours, et sans CTA de demande automatique. Le prestataire archivé est invité à contacter l'équipe par email.

Raison
------
Un profil peut être archivé pour d'autres raisons que la non-signature de la charte. Le CTA actuel lance une Edge Function qui vérifie explicitement `motif_suspension = 'charte_non_signee'` et bloque les autres cas. Il est préférable de supprimer ce CTA et de rediriger vers un contact manuel.

Modifications prévues
---------------------

1. `src/pages/Reactivation.tsx`
   - Remplacer le titre et le paragraphe par un wording générique sur l'archivage.
   - Supprimer la mention "60 jours pour signer la Charte Qualité".
   - Supprimer le bouton "Demander la réactivation de mon profil" et tout l'état de soumission (`status`, `errorMsg`, `handleSubmit`, icônes de chargement/succès/erreur).
   - Ajouter un bloc d'action secondaire avec un lien `mailto:contact@lesnoces.net`.
   - Simplifier le composant : conserver la récupération optionnelle de `prestataire_id` (pour tracé éventuel) mais retirer l'appel Edge Function.
   - Conserver le `SeoHead` existant ou l'adapter au nouveau wording.

2. `src/components/prestataire/ProviderInfoBanner.tsx`
   - Vérifier le libellé du lien vers `/reactivation` et l'adapter si nécessaire pour refléter le nouveau fonctionnement (par exemple "Contacter l'équipe" ou laisser "Demander la réactivation" selon le contexte).

3. `supabase/functions/request-reactivation-archive/index.ts`
   - Laisser la fonction en place : elle est toujours utilisée par `CharteSignatureFlow.tsx` (redirection `archive_locked` après échec de signature) et reste pertinente pour ce cas spécifique.
   - Mettre à jour le commentaire d'en-tête pour préciser qu'elle n'est plus la voie principale de la page `/reactivation`.

4. Vérifications
   - TypeScript (`npx tsc --noEmit` ou équivalent projet).
   - Aucune modification de base de données requise.

Non inclus
----------
- Suppression de la table `demande_reactivation_le` ou du champ existant.
- Modification des templates emails de réactivation (ils ne seront plus déclenchés depuis la page, mais restent utilisables côté serveur).
