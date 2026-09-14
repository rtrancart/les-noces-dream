# Tri qualité des prestataires (score_classement)

## 1. Mapping confirmé (vérifié en base)

**`prestataires`** : `note_moyenne`, `nombre_avis`, `description_courte`, `description`, `photo_principale_url`, `urls_galerie` (text[]), `telephone`, `email_contact`, `site_web`, `adresse`, `code_postal`, `ville`, `region`, `latitude`, `longitude`, `zones_intervention` (text[]), `champs_specifiques` (jsonb), `categorie_mere_id`, `categorie_fille_id`, `prix_depart`, `prix_max`, `taux_reponse` (numeric, NULL si non mesurable), `taux_reponse_nb_demandes_90j` (int), `updated_at`, `premier_login_le`, `date_premiere_publication`, `est_premium`, `est_verifie`, `statut`.

**`avis`** : `prestataire_id`, `note_globale` (real), `statut` (`en_attente|valide|rejete`), `created_at` — seuls les `valide` comptent.

**Réactivité** : `taux_reponse` / `taux_reponse_nb_demandes_90j`, alimentées par `public.calculer_taux_reponse(uuid)` et son cron existant. Aucun recalcul dupliqué.

**Vue publique** : `prestataires_public` (filtrée `statut='actif'`, avec `videos_json` en lateral join) — recréée à l'identique plus `score_classement`.

### Dépendance « dernière connexion » — tranchée
Il n'existe aucune colonne de dernière connexion sur `prestataires` (seul `premier_login_le`). Le journal d'authentification interne expose bien une date de dernière connexion, mais elle n'est renseignée que pour 26 comptes sur 462 : inexploitable, et hors périmètre (schéma d'authentification interdit aux triggers).

Décision retenue : **les deux combinés**.
- Ajout de `prestataires.derniere_connexion_le timestamptz`, mise à jour au chargement de l'espace prestataire (RPC dédiée `marquer_derniere_connexion()`, sur le modèle de `mark_prestataire_first_login()`, au plus une écriture par 24 h pour éviter le bruit d'écriture).
- Le critère Fraîcheur utilise `greatest(derniere_connexion_le, updated_at, premier_login_le, date_premiere_publication)`, donc opérationnel dès le premier jour et de plus en plus précis.

## 2. Colonne, index, score

- `prestataires.score_classement numeric(5,2)` default NULL.
- Index `(statut, score_classement DESC, est_premium DESC, note_moyenne DESC)`.

**`public.calculer_score_classement(p_prestataire_id uuid) returns numeric`** — STABLE, SECURITY DEFINER, `search_path = public`, toutes les tables préfixées explicitement `public.`. Pondération dynamique : un critère sans données réelles est retiré et son poids redistribué proportionnellement sur les critères actifs (jamais de 0 de substitution). Chaque sous-score normalisé sur [0,1], résultat final sur 0–100.

| Critère | Poids | Actif si | Calcul |
|---|---|---|---|
| Qualité des avis | 35 % | ≥ 1 avis validé | bayésien `(v/(v+m))·R + (m/(v+m))·C`, m = 5, C = moyenne plateforme des avis validés, normalisé `/5` |
| Complétude | 25 % | toujours | sous-score interne (ci-dessous) |
| Réactivité | 20 % | `taux_reponse_nb_demandes_90j > 0` | `(n·(taux_reponse/100) + k·taux_moyen_plateforme)/(n+k)`, k = 3 |
| Fraîcheur | 10 % | toujours | decay sur la date de référence : 1 si ≤ 30 j, linéaire jusqu'à 0 à 365 j |
| Ancienneté des avis | 5 % | ≥ 1 avis validé | decay moyen des `created_at` des avis validés : 1 si ≤ 90 j, jusqu'à 0 à 730 j |

Sous-score complétude (poids internes normalisés sur leur somme) :
- fort (3) : `description_courte` non vide · `description` ≥ 300 caractères (binaire) · photos (`photo_principale_url` présent + palier sur `urls_galerie` : 1 = 0,3 / 3 = 0,6 / 6 = 0,85 / 10+ = 1)
- moyen (2) : `zones_intervention` non vide · `champs_specifiques` renseignés · `prix_depart`
- faible (1) : `telephone` · `email_contact` · `site_web` · `adresse`+`code_postal` · GPS · `categorie_fille_id`

`est_premium`, `est_verifie`, boosts et abonnements n'entrent jamais dans le score.

## 3. Triggers

Chacun n'écrit que `score_classement`, avec garde `IS DISTINCT FROM` pour ne pas réveiller les triggers Brevo existants.
- `avis` : AFTER INSERT, AFTER UPDATE de `statut`/`note_globale`, AFTER DELETE.
- `prestataires` : BEFORE UPDATE sur les champs de complétude, les colonnes `taux_reponse*` et `derniere_connexion_le` — affectation directe de `NEW.score_classement`, donc non récursive.
- `messages` et `demandes_devis` : AFTER INSERT → recalcul du prestataire concerné.

## 4. Batch

`public.recalculer_tous_les_scores(p_limit int default null, p_offset int default 0) returns int` — SECURITY DEFINER, exécution réservée au service role / admin, écriture conditionnelle `IS DISTINCT FROM`. Lancée une fois après la migration.

## 5. Cron nocturne

Nécessaire : les critères à decay temporel (fraîcheur, ancienneté des avis) baissent sans qu'aucun événement ne déclenche de trigger — sans lui, une fiche modifiée récemment passerait devant une fiche excellente mais figée. Planification quotidienne unique à 03:20 UTC (1 exécution par jour, décalée des autres crons de nuit), donc coût récurrent négligeable et décalage maximal de 24 h sur les seuls effets d'ancienneté.

## 6. Tri de la recherche + bruit anti-monotonie

Bruit déterministe, **non stocké** : calculé au tri via `hashtext(id::text || current_date::text)` normalisé sur ± 2,5 points, seed journalière (classement stable sur 24 h, rotation quotidienne).

Tri par défaut : `(score_classement + bruit) DESC NULLS LAST, est_premium DESC, note_moyenne DESC`.

Comme PostgREST ne permet pas d'exprimer ce tri, il sera porté par une fonction SQL de classement : `public.score_classement_bruite(p_id uuid, p_score numeric) returns numeric` (STABLE, car elle dépend de `current_date`), exposée dans `prestataires_public` sous forme d'une colonne calculée `score_tri`, sur laquelle les pages font `.order("score_tri", { ascending: false, nullsFirst: false }).order("est_premium", ...).order("note_moyenne", ...)`.

- `src/pages/Recherche.tsx` (l. 33-37) et `src/pages/PrestatairesListe.tsx` (l. 128-134) : `score_classement` ajouté au `select`, tri remplacé.
- Tris explicites par distance et par prix : `ORDER BY` purs, sans bruit — inchangés.
- Filtres, carte, et sélection « coups de cœur » premium de l'accueil : inchangés.

## 7. Vérifications

- Distribution du score après batch (min / moyenne / max, nombre de NULL) et contrôle qu'une fiche sans avis ni demande n'est pas pénalisée par des zéros.
- Anti pay-to-win : requête de contrôle montrant un premium à faible score classé derrière un standard à score élevé.
- Rotation du bruit : même fiche, deux seeds de dates différentes → ordre des quasi-ex æquo modifié, ordre des écarts réels préservé.
- `tsgo` + Vitest (3 échecs préexistants dans `ResultsPage.test.tsx`, sans lien).
