# Essai gratuit des prestataires migrés : 90 jours à partir de l'invitation

## Réponse à la question de visibilité

Une fiche sans abonnement ni `fin_essai_le` **reste visible** sur le site. La visibilité publique ne dépend que de `statut = 'actif'` : la recherche filtre sur ce seul critère, et la fiche publique passe par la même règle. Ni l'existence d'un abonnement, ni la date de fin d'essai, ni Stripe n'entrent dans le calcul de visibilité aujourd'hui.

## Situation actuelle (vérifiée)

- 3 230 abonnements `plan = essai`, `statut = trialing`, sans lien Stripe, créés à l'import du 22/07/2026.
- `fin_essai_le` identique pour tout le parc : 20/10/2026 (import + 90 jours fixes).
- Aucune fiche migrée n'a encore de compte ni d'invitation ouverte : `user_id`, `compte_active_le`, `premier_login_le` sont vides sur les 3 230 fiches. Le recalage se fait donc sans léser personne.

## Nouvelle règle

Le point de départ des 90 jours devient l'**envoi de l'invitation** (`prestataires.magic_link_envoye_le`), le même moment que celui qui ouvre le tunnel côté Brevo.

- Tant qu'aucune invitation n'est partie : `fin_essai_le` vide, aucun décompte ne court.
- À l'envoi de l'invitation : `fin_essai_le = magic_link_envoye_le + 90 jours`, posé une seule fois.
- Une invitation renvoyée plus tard ne réinitialise pas et ne prolonge pas la date.
- Uniquement pour `origine = 'migration'` ; les inscriptions admin et auto-inscriptions gardent leur fonctionnement actuel.

Cette échéance s'aligne ainsi sur l'exemption de charte, elle aussi individualisée par fiche.

## Date limite modifiable par l'admin

Dans la fiche prestataire de l'admin, une ligne « Essai gratuit — fin le … » avec un bouton d'édition ouvrant une saisie de date. L'admin peut avancer, repousser ou vider la date. Chaque modification est tracée dans le journal d'activité admin. La date saisie prévaut ensuite sur tout recalcul automatique.

## Souscription à tout moment

La page Abonnement reste accessible en permanence et le prestataire peut souscrire quand il le souhaite, y compris pendant l'essai : la carte est enregistrée immédiatement et le premier prélèvement est repoussé à la fin de l'essai (`trial_end` transmis à Stripe). Si l'essai est déjà terminé ou la date vide, la facturation démarre immédiatement — comportement déjà en place, rien à modifier.

## Badge « Essai gratuit »

Badge affiché dans l'espace pro du prestataire (bandeau du tableau de bord et page Profil), visible tant que `fin_essai_le` est dans le futur et qu'aucun abonnement payant n'est actif. Libellé : « Essai gratuit — jusqu'au JJ mois AAAA », avec un ton d'alerte dans les 15 derniers jours. Badge interne : il n'apparaît pas sur la fiche publique.

## Détails techniques

1. **Migration SQL**
   - `UPDATE abonnements SET fin_essai_le = NULL` pour les prestataires `origine = 'migration'` dont `magic_link_envoye_le` est vide (aujourd'hui : les 3 230).
   - Fonction trigger `set_fin_essai_migration()` sur `prestataires`, `AFTER UPDATE OF magic_link_envoye_le` : si `origine = 'migration'` et passage NULL → non NULL, écrit `fin_essai_le = magic_link_envoye_le + interval '90 days'` sur la ligne `abonnements` du prestataire, seulement quand `fin_essai_le IS NULL` (idempotent).
   - Backfill pour les fiches migrées déjà invitées au moment de la migration (actuellement aucune).
2. **Admin** — édition de `abonnements.fin_essai_le` depuis la fiche prestataire (`src/pages/admin/Prestataires.tsx`), avec `logAdmin`. Une politique de mise à jour d'`abonnements` réservée aux admins est ajoutée si elle manque.
3. **Badge** — composant dans `src/components/prestataire/`, alimenté par la requête abonnement déjà présente dans l'espace pro.
4. **Brevo** — `FIN_ESSAI` est déjà synchronisé depuis `abonnements.fin_essai_le` ; la nouvelle date remonte automatiquement.
5. Aucun changement dans `stripe-create-checkout` ni dans le webhook Stripe.
