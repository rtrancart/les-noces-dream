# Gratuité des prestataires migrés : 90 jours à partir de l'activation du compte

## Situation actuelle (vérifiée)

- 3 230 abonnements `plan = essai`, `statut = trialing`, sans lien Stripe, créés à l'import du 22/07/2026.
- `fin_essai_le` est identique pour tout le parc : **20/10/2026** (import + 90 jours fixes).
- **Aucune** fiche migrée n'a encore de compte : `user_id`, `compte_active_le` et `premier_login_le` sont vides sur les 3 230 fiches. Le recalage peut donc se faire sans léser personne.
- L'exemption de charte suit déjà ce principe : `charte_exemptee_jusqua` est posée individuellement au moment de la validation.

## Nouvelle règle

L'essai gratuit de 90 jours démarre à l'**activation du compte** (`prestataires.compte_active_le`, posé automatiquement quand un `user_id` est rattaché à la fiche), et non plus à une date commune.

- Tant que le compte n'est pas activé : pas de date de fin d'essai (`fin_essai_le` vide), aucun décompte ne court.
- À l'activation : `fin_essai_le = compte_active_le + 90 jours`.
- Cette date reste posée une seule fois, jamais recalculée ni prolongée ensuite.
- Uniquement pour `origine = migration`. Les inscriptions admin et auto-inscriptions gardent leur fonctionnement actuel.

Le reste de la mécanique est déjà compatible : la souscription Stripe relit `fin_essai_le` et le transmet en `trial_end`, donc la carte est enregistrée immédiatement et le premier prélèvement tombe à l'échéance des 90 jours. Si `fin_essai_le` est vide, la facturation démarre immédiatement — cas qui ne peut pas se produire puisqu'on ne peut souscrire qu'une fois connecté, donc après activation.

## Affichage prestataire

Sur la page Abonnement, avant activation il n'y a rien à afficher (le prestataire n'y accède pas). Après activation, le libellé existant « Fin de l'essai le … » affiche la date individuelle. Aucun changement d'écran nécessaire.

## Détails techniques

1. **Migration SQL**
   - Remise à zéro : `UPDATE abonnements SET fin_essai_le = NULL` pour les fiches `origine = 'migration'` dont le prestataire n'a pas de `compte_active_le` (aujourd'hui : les 3 230).
   - Nouvelle fonction trigger `set_fin_essai_migration()` sur `prestataires`, `AFTER UPDATE OF user_id` (après `trg_set_compte_active_le` pour que `compte_active_le` soit déjà renseigné) : si `origine = 'migration'` et passage de `user_id` NULL → non NULL, met à jour la ligne `abonnements` du prestataire avec `fin_essai_le = compte_active_le + interval '90 days'`, uniquement quand `fin_essai_le IS NULL` (idempotent, jamais de prolongation).
   - Backfill de sécurité pour les fiches migrées déjà activées au moment de la migration (actuellement aucune).

2. **Brevo** : `FIN_ESSAI` est déjà synchronisé depuis `abonnements.fin_essai_le` par `brevo-sync-prestataire`, et le trigger d'activation émet déjà `compte_active` + `presta_sync`. La nouvelle date remontera donc automatiquement.

3. Aucun changement dans `stripe-create-checkout` ni dans le webhook Stripe.
