# Tri qualité des prestataires (score_classement)

## 1. Mapping des colonnes réellement disponibles (vérifié en base)

**`prestataires`** (colonnes utiles au score)
- Avis : `note_moyenne` (real), `nombre_avis` (int), `note_qualite_prestation`, `note_professionnalisme`, `note_rapport_qualite_prix`, `note_flexibilite`
- Complétude : `description_courte`, `description`, `photo_principale_url`, `urls_galerie` (text[]), `telephone`, `email_contact`, `site_web`, `adresse`, `code_postal`, `ville`, `region`, `latitude`, `longitude`, `zones_intervention` (text[]), `champs_specifiques` (jsonb), `categorie_mere_id`, `categorie_fille_id`, `prix_depart`, `prix_max`
- Réactivité : `taux_reponse` (numeric, NULL si non mesurable), `taux_reponse_nb_demandes_90j` (int), `taux_reponse_calcule_le`
- Fraîcheur : `updated_at`, `premier_login_le`, `date_premiere_publication`
- Départage : `est_premium`, `est_verifie`
- Filtre visibilité : `statut = 'actif'`
- Pas de colonne `score_classement` aujourd'hui → à créer.

**`avis`** : `prestataire_id`, `note_globale` (real), `statut` (enum `en_attente|valide|rejete`), `created_at`. Seuls les avis `valide` seront comptés.

**Messages / réactivité** : `demandes_devis` (`prestataire_id`, `created_at`) + `messages` (`demande_id`, `expediteur_type`, `created_at`). La fonction existante `calculer_taux_reponse(uuid)` renvoie déjà `(taux, nb_demandes)` sur 90 jours et NULL quand aucune demande — c'est elle qui alimentera le critère réactivité (pas de recalcul dupliqué).

**Vue de lecture publique** : `prestataires_public` (filtrée `statut='actif'`) — c'est elle qu'interrogent la recherche et les listes ; elle devra exposer `score_classement`.

## 2. Ce qui va être construit

**Colonne** `prestataires.score_classement numeric(5,2)` par défaut NULL, plus un index `(statut, score_classement DESC, est_premium DESC, note_moyenne DESC)`.

**Fonction `public.calculer_score_classement(p_prestataire_id uuid) returns numeric`** (STABLE, SECURITY DEFINER, `search_path = public`) — pondération dynamique, chaque sous-score normalisé sur [0,1], poids des critères absents redistribués proportionnellement, résultat ramené sur 0–100 :

| Critère | Poids | Actif si | Calcul |
|---|---|---|---|
| Qualité des avis | 35 % | ≥ 1 avis validé | Bayésien `(v/(v+m))·R + (m/(v+m))·C`, m = 5, C = moyenne plateforme des avis validés, normalisé `/5` |
| Complétude du profil | 25 % | toujours | sous-score interne pondéré (voir ci-dessous) |
| Réactivité | 20 % | `taux_reponse IS NOT NULL` et `taux_reponse_nb_demandes_90j > 0` | `taux_reponse / 100` |
| Fraîcheur | 10 % | toujours | decay sur `greatest(updated_at, premier_login_le)` : 1 à ≤ 30 j, décroissance linéaire jusqu'à 0 à 365 j |
| Ancienneté des avis | 5 % | ≥ 1 avis validé | decay moyen des `created_at` des avis (1 à ≤ 90 j → 0 à 730 j) |

Sous-score de complétude (poids internes, normalisés sur leur somme) :
- fort (3) : `description_courte` non vide, `description` ≥ 300 caractères, photos (`photo_principale_url` + palier sur le nombre d'`urls_galerie` : 1 photo = 0,3 / 3 = 0,6 / 6 = 0,85 / 10+ = 1)
- moyen (2) : `zones_intervention` non vide, `champs_specifiques` renseignés, `prix_depart`
- faible (1) : `telephone`, `email_contact`, `site_web`, `adresse` + `code_postal`, coordonnées GPS, `categorie_fille_id`

**Aucune prise en compte de `est_premium`, `est_verifie`, boost ou abonnement dans le score.** Le premium ne sert qu'au départage.

**Triggers de recalcul** (chacun écrit uniquement `score_classement`, avec garde `IS DISTINCT FROM` pour éviter de réveiller inutilement les triggers Brevo déjà posés sur `prestataires`) :
- `avis` : après insertion, modification de `statut`/`note_globale`, suppression
- `prestataires` : avant modification des champs de complétude et des colonnes `taux_reponse*` (calcul en `BEFORE UPDATE`, donc sans écriture récursive)
- `messages` et `demandes_devis` : après insertion → recalcul du prestataire concerné

**Batch `public.recalculer_tous_les_scores(p_limit int default null, p_offset int default 0) returns int`** (SECURITY DEFINER, réservée au service role / admin) pour l'initialisation et un recalcul périodique. Elle sera lancée une fois après la migration ; l'ajout d'un cron nocturne est mentionné mais mis en option (les scores des critères à decay temporel dérivent lentement).

**Tri de la recherche** : dans `src/pages/Recherche.tsx` (l. 33-37) et `src/pages/PrestatairesListe.tsx` (l. 128-134), remplacer le tri actuel `est_premium DESC, note_moyenne DESC` par `score_classement DESC (nulls last), est_premium DESC, note_moyenne DESC`, et ajouter `score_classement` au `select`. La vue `prestataires_public` est recréée pour exposer la colonne. Les filtres, la carte et le tri par distance existants ne changent pas ; la sélection « coups de cœur » de la page d'accueil reste sur le statut Premium.

## 3. Vérifications prévues
- Distribution du score après batch (min/moyenne/max, nombre de NULL) et contrôle qu'un profil sans avis ni demande obtient un score cohérent, non pénalisé par des zéros.
- Contre-exemple anti pay-to-win : un premium à faible score doit se classer derrière un standard à score élevé.
- `tsgo` + tests Vitest existants (`ResultsPage.test.tsx` contient 3 échecs préexistants, sans lien).
