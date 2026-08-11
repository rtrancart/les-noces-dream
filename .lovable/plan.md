# Test de bout en bout de la connexion Pennylane

## Ce qui est déjà vérifié

- Le jeton API est valide : l'encart « Connexion Pennylane » du tableau de bord admin a répondu OK (lecture des clients autorisée).
- La chaîne de synchro existe : le webhook Stripe appelle `syncStripeInvoiceToPennylane` sur `invoice.payment_succeeded`, écrit une ligne dans `factures_pennylane`, puis crée le client et la facture côté Pennylane.

Ce qui n'a jamais été exercé en réel : la **création** d'un client et d'une facture dans Pennylane. Seule la lecture a été testée.

## Objectif du test

Rejouer la chaîne complète — prestataire → client Pennylane → facture Pennylane → ligne en base → affichage dans l'espace prestataire — sans attendre un vrai paiement Stripe, et sans polluer durablement la comptabilité.

## Déroulé proposé

### 1. Fonction de test admin `pennylane-test-e2e`
Nouvelle Edge Function, réservée aux rôles admin / super_admin, qui :
- prend en entrée un `prestataire_id` (par défaut la fiche « Test Presta ») ;
- fabrique une facture Stripe fictive en mémoire (montant 1,00 € HT + TVA 20 %, `stripe_invoice_id` préfixé `test_e2e_<timestamp>` pour ne jamais entrer en collision avec une vraie facture) ;
- appelle exactement le même code de production `syncStripeInvoiceToPennylane` — aucune logique dupliquée, donc le test valide vraiment le chemin réel ;
- renvoie un rapport détaillé étape par étape : client Pennylane trouvé ou créé (avec son id), facture créée (id, numéro, URL du PDF), ligne en base, et le message d'erreur exact en cas d'échec.

### 2. Mode brouillon et nettoyage
- La facture de test est créée **en brouillon** côté Pennylane quand l'API le permet, pour qu'elle ne parte pas en comptabilité.
- La fonction accepte un paramètre `nettoyer` : suppression de la facture de test dans Pennylane (si supprimable en brouillon) et de la ligne `factures_pennylane` correspondante, une fois le résultat constaté.
- Si la suppression n'est pas possible côté Pennylane, le rapport l'indique clairement avec le numéro à annuler manuellement.

### 3. Bouton dans l'admin
Ajout, dans l'encart « Connexion Pennylane » du tableau de bord, d'un second bouton **« Test complet (facture de démo) »** avec :
- une confirmation avant lancement (rappel qu'une facture de démo sera créée) ;
- l'affichage du rapport étape par étape ;
- un bouton **« Supprimer la facture de test »** après coup.

### 4. Vérification finale
- Contrôle dans Pennylane que le client et la facture apparaissent avec les bonnes coordonnées (raison sociale, adresse, SIRET / TVA si renseignés).
- Contrôle côté site que la facture s'affiche dans **Espace pro → Abonnement** puis disparaît après nettoyage.
- Relecture des journaux de la fonction pour confirmer l'absence d'erreur silencieuse.

## Détails techniques

- Fichiers créés : `supabase/functions/pennylane-test-e2e/index.ts`.
- Fichiers modifiés : `supabase/config.toml` (`verify_jwt = true`), `src/components/admin/PennylaneConnectionPanel.tsx`.
- Aucun changement de schéma ; les lignes de test utilisent la table `factures_pennylane` existante avec un identifiant Stripe factice reconnaissable.
- Le jeton Pennylane reste exclusivement côté serveur.

## Alternative

Si vous préférez ne rien créer du tout dans Pennylane, on peut se limiter à un test « à blanc » : la fonction construit les payloads exacts et les affiche sans les envoyer. Cela valide le mapping des données mais pas l'acceptation par Pennylane — un vrai paiement resterait le premier test réel.
