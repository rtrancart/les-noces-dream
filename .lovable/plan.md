# Export KPI quotidien vers Google Sheets — Étape 1 : audit (rien n'a été modifié)

## 1. Compteur `nombre_demandes` toujours à 0

**Cause confirmée :** aucun déclencheur ni aucune fonction n'écrit jamais cette colonne. Elle a été créée avec la valeur 0 par défaut et n'est que relue (aperçus de fiche, recherche). Les demandes sont bien rattachées : 8 demandes depuis le 01/10/2026, toutes avec un `prestataire_id`.

Demandes réelles par fiche depuis le 01/10/2026 :

| Fiche | Validées | Rejetées |
|---|---|---|
| Flash Production | 1 | 0 |
| L'Atelier Nomade | 1 | 0 |
| Studio Rodolphe Photo | 1 | 0 |
| Anthony Daniels, Douces Mesures, Fast rent furious, Julie Soudé, Nicolas Baudry Photographe | 0 | 1 chacune |

**Correctif proposé (à part, après accord) :** un déclencheur sur `demandes_devis` qui recalcule `nombre_demandes` = nombre de demandes `moderation = 'valide'` de la fiche (à la création et au changement de modération), puis un rattrapage unique sur toutes les fiches. Seules les validées comptent, conformément à la règle « un prestataire ne voit que les demandes validées ». Ce correctif n'est pas inclus dans l'export.

## 2. Indicateurs : source et disponibilité

Journée = `created_at AT TIME ZONE 'Europe/Paris'`. « Recalculable » = on peut le recalculer pour une date passée.

### Couples / conversion

| Indicateur | Source | Dispo | Recalculable |
|---|---|---|---|
| demandes_devis_valides / rejetees | `demandes_devis.moderation` | Oui | Oui |
| affichages_telephone | `evenements_prestataire` type `affichage_telephone` | Oui | Oui |
| visites_fiches | `evenements_prestataire` type `vue_profil` (robots déjà purgés, filtre `estVisiteAutomatisee` en amont, mêmes règles que `admin_statistiques_activite_hebdo`) | Oui | Oui |
| fiches_vues_distinctes | idem, `count(distinct prestataire_id)` | Oui | Oui |
| comptes_couples_crees | `user_roles` role `client` × `profiles.created_at` | Oui | Oui |
| favoris_ajoutes | `favoris.created_at` | Oui | Oui (hors favoris supprimés depuis) |
| emails_couples_collectes | aucune newsletter ni téléchargement stocké ; seul proxy : `profiles.consentement_marketing_le` | Partiel (proxy) | Oui |
| détail par source | `demandes_devis.source` ne contient que « lesnoces.net » ; `evenements_prestataire` n'a ni utm ni referrer | **Non** | — |

### Prestataires (photo du jour, non recalculable)

| Indicateur | Calcul |
|---|---|
| fiches_actives | `statut = 'actif'` |
| fiches_correctes | actives, ≥ 3 photos (`photo_principale_url` + `urls_galerie`) ET `length(description) ≥ 300` |
| fiches_completes | correctes + ≥ 6 photos + `prix_depart` renseigné |
| fiches_avec_prix / avec_6_photos / avec_avis | `prix_depart`, nb photos, `nombre_avis > 0` |
| comptes_prestataires_actives | `compte_active_le` non nul |
| prestataires_connectes_7j | `derniere_connexion_le ≥ J-7` |
| chartes_signees | `charte_signee_le` non nul |
| prestataires_en_essai | `abonnements.statut = 'trialing'` (3 216 aujourd'hui) |
| abonnes_payants par formule | `statut = 'actif'` groupé par `formule` (0 aujourd'hui → colonnes standard / premium) |
| suspendus | `prestataires.statut = 'suspendu'` |
| score_classement_moyen | `avg(score_classement)` des actives |

### Technique et contenu

| Indicateur | Source | Dispo |
|---|---|---|
| snapshots a_jour / a_traiter / abandonne | `prerender_queue.statut` | Oui (photo du jour) |
| pages_indexables | `prerender_pages_indexables()` | Oui (photo du jour) |
| articles_publies | `articles_blog.est_publie` | Oui, recalculable via `publie_le` |
| atelier_couples_actifs_7j | `conversations_atelier.updated_at` + `ia_logs.user_id` distincts | Oui, à peu près recalculable |
| atelier_cout_ia_jour | `sum(ia_logs.cout_eur)` du jour, hors comptes @lesnoces.test | Oui, recalculable |

## 3. Écriture vers Google Sheets (compte de service)

Étapes de votre côté :
1. Google Cloud Console : créer un projet, activer l'**API Google Sheets**.
2. Créer un **compte de service**, puis une **clé JSON**.
3. Créer la feuille, ajouter un onglet `kpi_quotidiens`, la **partager en Éditeur** avec l'adresse e-mail du compte de service.
4. Me donner l'identifiant de la feuille (l'URL suffit).
5. Coller la clé JSON dans le formulaire sécurisé que j'ouvrirai (secret `GOOGLE_SERVICE_ACCOUNT_JSON`).

Fonctionnement : la fonction signe un jeton avec la clé, lit la colonne A pour trouver la date, puis remplace la ligne existante ou en ajoute une. Une seule écriture groupée par exécution.

(Autre option possible : le connecteur Google Sheets intégré de Lovable, sans clé à gérer. Il est lié à votre compte Google et pas à un compte de service.)

## 4. Planification (aucun nouveau cron)

- Le cron des scores (03:20) est du **SQL seul** (`recalculer_tous_les_scores()`) : y ajouter un appel HTTP le compliquerait.
- **Recommandation : `cron-prerender-nightly` (03:00)**, une fonction du backend. À la fin de son travail, un appel à `kpi-export-sheets` est fait dans un `try/catch` isolé, avec un délai maximal. Le résultat (ok / erreur, date, nombre de colonnes) est seulement journalisé. Une erreur d'export ne change jamais le statut renvoyé par le pré-rendu.

## Étape 2 — Implémentation (après validation)

- Fonction SQL `get_kpi_quotidiens(date)` en SECURITY DEFINER, exécutable par service_role seul. Elle renvoie une ligne JSON avec un champ `null` pour chaque indicateur indisponible ou non recalculable à cette date.
- Fonction `kpi-export-sheets` : par défaut la veille (heure de Paris). Écriture idempotente : la date est en colonne A au format AAAA-MM-JJ, avec une colonne par indicateur. Une valeur `null` donne une cellule vide, jamais 0. La ligne d'en-tête est créée si besoin.
- Mode rattrapage `{ "rattrapage": true }`, réservé aux admins : du 01/10/2026 à hier, uniquement pour les indicateurs recalculables. Les photos du jour ne sont remplies que pour la date du jour.
- Branchement dans `cron-prerender-nightly` comme décrit au point 4.
- Aucune donnée métier, aucun compteur et aucun écran modifiés. Aucune donnée personnelle exportée.
- Fin : je vous montre la ligne d'hier et le nombre de jours rattrapés (53 attendus).
