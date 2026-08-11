# Connexion Pennylane — factures d'abonnement

## Ce qu'est Pennylane, en clair

Pennylane est une plateforme française de gestion financière et comptable. Trois usages principaux :

- **Facturation client** : émission, envoi et suivi des factures de vente (payées / impayées / relances).
- **Comptabilité** : chaque facture devient une écriture comptable, transmise automatiquement à l'expert-comptable.
- **Banque & trésorerie** : rapprochement des encaissements avec les factures.

Pour LesNoces, l'intérêt est la **facturation des abonnements prestataires** : aujourd'hui les paiements passent par Stripe, mais la compta ne reçoit rien automatiquement depuis le site. Pennylane devient le registre officiel des factures de vente.

## Objectif retenu

1. Chaque paiement d'abonnement Stripe crée (ou met à jour) le client et la facture de vente dans Pennylane.
2. Les factures sont consultables dans l'admin (par prestataire) **et** par le prestataire lui-même dans son espace, avec téléchargement du PDF.

## Données qui remontent

**Du site vers Pennylane** (à chaque facture payée) :

| Donnée | Source |
| --- | --- |
| Raison sociale / nom commercial | `prestataires.raison_sociale` |
| Adresse, code postal, ville, pays | `prestataires` + adresse de facturation Stripe |
| Email de facturation | `prestataires.email_contact` |
| SIRET / TVA intracommunautaire | **manquant en base — à collecter** (voir Prérequis) |
| Libellé de la formule (Standard / Premium, mensuel / annuel) | `abonnements.plan` |
| Montant HT, TVA 20 %, TTC | facture Stripe |
| Date de facture, date d'échéance, statut payé | facture Stripe |
| Référence externe (id facture Stripe) | anti-doublon |

**De Pennylane vers le site** (lecture) :

| Donnée | Usage |
| --- | --- |
| Numéro de facture officiel | Affichage admin + espace prestataire |
| Statut (payée / en retard / avoir) | Suivi des impayés côté admin |
| Montant, date | Historique de facturation |
| Lien du PDF | Bouton « Télécharger la facture » |

Ne remontent pas : les achats/fournisseurs, les écritures comptables brutes, les données bancaires — inutiles pour le site.

## Prérequis à confirmer avant de coder

1. **Type de compte Pennylane.** Il faut un compte *entreprise* (pas un accès invité de cabinet comptable) pour générer un jeton API. À vérifier dans Pennylane : icône compte → *Paramètres* → *Entreprise* → **API / Intégrations**. Si l'entrée « Générer un jeton API » est absente, c'est un accès cabinet et il faudra demander au comptable de vous donner les droits sur la société.
2. **Numérotation des factures.** Deux options : Pennylane génère le numéro officiel (recommandé), ou on importe le PDF Stripe tel quel. Je pars sur la génération par Pennylane.
3. **SIRET / TVA prestataires.** Champs absents en base. Sans eux, les factures B2B seront incomplètes. Je prévois de les ajouter au profil prestataire (facultatif, mais demandé lors de la souscription).
4. **Rattrapage historique.** Par défaut on ne synchronise que les nouvelles factures ; les anciennes peuvent être rejouées à la demande via une action admin.

## Implémentation

### Étape 1 — Connexion et test
- Secret backend `PENNYLANE_API_TOKEN` (jeton « Company », scopes `customers:all` + `customer_invoices:all`).
- Module partagé `supabase/functions/_shared/pennylane-client.ts` : base `https://app.pennylane.com/api/external/v2`, en-tête `Authorization: Bearer`, erreurs normalisées (jeton invalide, scope manquant, quota, indisponible), timeout et retry paramétrables — sur le modèle du client Brevo existant.
- Edge Function `pennylane-test-connection` (admin uniquement) + encart « Connexion Pennylane » dans le dashboard admin, comme l'encart Brevo.

### Étape 2 — Base de données
- Table `factures_pennylane` : `prestataire_id`, `stripe_invoice_id` (unique), `pennylane_invoice_id`, `numero`, `montant_ht_cents`, `montant_tva_cents`, `montant_ttc_cents`, `date_facture`, `statut`, `pdf_url`, `synchronise_le`, `erreur`.
- Colonne `pennylane_customer_id` sur `prestataires` (+ `siret`, `tva_intracom` optionnels).
- RLS : admin sur tout, prestataire en lecture sur ses propres lignes uniquement.
- Journal de synchro réutilisant le motif `brevo_sync_log` (statut, tentatives, motif d'échec).

### Étape 3 — Synchro sortante
- Le webhook Stripe existant (`invoice.paid`, `invoice.payment_failed`, `credit_note.created`) déclenche la synchro de façon **découplée** : insertion d'une ligne à traiter, jamais d'appel Pennylane bloquant dans le webhook.
- Edge Function `pennylane-sync-facture` : récupère la facture Stripe, crée/retrouve le client Pennylane (recherche par référence externe = id prestataire, puis par email), crée la facture finalisée avec sa ligne de prestation et la TVA 20 %, enregistre le numéro et le PDF en base.
- Idempotence stricte sur `stripe_invoice_id` : un rejeu Stripe ne crée jamais de doublon comptable.
- Cron de rattrapage horaire pour les lignes en échec (retry borné, puis alerte admin).

### Étape 4 — Affichage
- **Admin** : nouvel onglet « Facturation » sur la fiche prestataire (liste des factures, statut, PDF, bouton « Resynchroniser »).
- **Prestataire** : bloc « Mes factures » dans `src/pages/prestataire/Abonnement.tsx` — liste et téléchargement des PDF, aucune donnée d'un autre prestataire accessible.

## Détails techniques

- Fichiers créés : `supabase/functions/_shared/pennylane-client.ts`, `supabase/functions/pennylane-test-connection/index.ts`, `supabase/functions/pennylane-sync-facture/index.ts`, `src/components/admin/PennylaneConnectionPanel.tsx`, `src/components/admin/PrestataireFacturationTab.tsx`.
- Fichiers modifiés : `supabase/functions/stripe-webhook/index.ts` (déclenchement découplé), `supabase/config.toml`, `src/pages/admin/Dashboard.tsx`, `src/pages/prestataire/Abonnement.tsx`.
- Le jeton Pennylane n'est jamais lu côté navigateur : uniquement via `Deno.env.get()` dans les Edge Functions.
- Ordre d'exécution : je demande d'abord le jeton, je teste la connexion réellement, puis j'enchaîne base → synchro → affichage.
- Alternative à connaître : Stripe propose une intégration native vers Pennylane pour les encaissements. Elle est plus rapide à activer mais ne rattache pas les factures à vos fiches prestataires et ne permet pas l'affichage dans l'espace prestataire.
