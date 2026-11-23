# Export KPI quotidien vers Google Sheets — plan ajusté

## A. Réponses préalables (vérifiées, rien de modifié)

### Où `nombre_demandes` est utilisé
- **Écrans (public, espace prestataire, admin) :** aucun. Le code de l'application ne lit ni n'affiche jamais ce champ.
- **Fonctions de la base (score_classement, taux de réponse, emails, synchro Brevo) :** aucune ne le lit.
- **Edge Functions (emails, Brevo, sitemap, pré-rendu) :** aucune référence.
- **Seule présence :** le champ est inclus dans les vues et aperçus de fiche qui recopient toutes les colonnes. Il est donc lisible par l'API publique, mais rien ne l'affiche.
- **Conséquence :** le déclencheur et le rattrapage ne changent aucun écran, aucun score et aucun email. **Je ne les applique qu'après votre accord explicite sur cette liste** (étape C1).

### Fiches de test proposées (à confirmer)
| Fiche | Statut | Raison |
|---|---|---|
| Studio Rodolphe Photo | archivée | compte rodolphe.trancart+prestataire |
| Rodolphe Photo | archivée | compte rodolphe@lesnoces.net |
| Test Nathalie 1 | suspendue | nom + compte lesnoces1+test01 |
| Carole Wedding Planner | archivée | compte famille Trancart |
| Margaux Décoration | archivée | compte famille Trancart |
| Augustin Voitures de Prestige | archivée | compte famille Trancart |

Exclusion aussi de tout compte `@lesnoces.test`. La liste sera stockée dans un petit réglage modifiable, et non codée en dur.

### Connecteur Google Sheets intégré
Il fonctionne depuis une fonction du backend lancée par un cron, sans session utilisateur. Il utilise une clé de connexion stockée côté serveur et rattachée au compte Google qui a autorisé la connexion, pas au visiteur. **Choix : le connecteur intégré**, avec une vérification réelle par un appel depuis la fonction avant le branchement au cron. Si cet appel échoue, je passe au compte de service.

## B. Règles d'export
- Le cron de 03:00 UTC (04:00 à Paris en hiver, 05:00 en été) écrit **une seule ligne : la veille** (heure de Paris).
- Les indicateurs « photo du jour » (prestataires, snapshots, pages indexables) sont écrits sur cette même ligne et valent état en fin de veille. Il n'y a pas de seconde ligne.
- La ligne est idempotente (date en colonne A) : elle est remplacée si la date existe déjà. Un indicateur indisponible donne une cellule vide, jamais 0.
- Les données de test sont exclues partout : demandes, événements, comptes, fiches et Atelier.

## C. Implémentation

1. **Compteur `nombre_demandes`** (après votre accord sur la liste A) : un déclencheur recalcule le compteur des demandes `moderation = 'valide'` à la création et au changement de modération, puis un rattrapage unique est lancé.
2. **Source des conversions (nouveau) :**
   - À la première page de la session, le site enregistre en sessionStorage, sans jamais l'écraser : `utm_source`, `utm_medium`, `utm_campaign`, le **domaine** du referrer et `gclid_present` (vrai/faux, jamais la valeur).
   - Nouvelles colonnes, toutes facultatives, sur `demandes_devis` et `evenements_prestataire`, remplies seulement pour les nouvelles demandes et les nouveaux `affichage_telephone`. Les lignes existantes ne sont pas touchées. Ces champs passent par `soumettre_demande_devis` et par l'enregistrement des événements.
   - Règle de regroupement (documentée dans AGENTS.md), appliquée dans cet ordre :
     - google_ads : `gclid_present` ou utm_source google avec medium cpc/ppc/paid
     - chatgpt : referrer chatgpt.com/openai.com ou utm_source chatgpt
     - meta : facebook, instagram, fb, ig, meta (utm ou referrer)
     - pinterest : pinterest (utm ou referrer)
     - email : utm_medium email/newsletter, ou referrer d'un webmail
     - seo : referrer google, bing, duckduckgo, ecosia, qwant, yahoo sans utm payant
     - direct : ni utm ni referrer externe
     - autre : tout le reste
   - Export : `demandes_valides_<source>` et `affichages_telephone_<source>`. Les jours antérieurs à la mise en place restent vides, jamais à 0.
3. **`get_kpi_quotidiens(date)`** en SECURITY DEFINER, exécutable par service_role seul. Elle renvoie une ligne avec tous les indicateurs de l'audit, avec les exclusions de test.
4. **Fonction `kpi-export-sheets`** : par défaut la veille. Écriture idempotente dans l'onglet `kpi_quotidiens`, en-tête créée si besoin. Mode rattrapage réservé aux admins, du 01/10/2026 à hier, uniquement pour les indicateurs recalculables (photos du jour et sources vides pour le passé).
5. **Branchement** dans `cron-prerender-nightly`, dans un bloc `finally` isolé (son propre try/catch et un délai maximal) : l'export tourne même si le pré-rendu échoue, sans jamais changer son résultat. Le statut est journalisé.
6. Aucune autre donnée métier, aucun autre compteur et aucun écran ne sont modifiés.

## D. Ce que vous aurez à faire
- Confirmer la liste des fiches de test.
- Valider la liste des usages de `nombre_demandes` (point A).
- Dans la carte qui s'affichera : connecter ou choisir votre compte Google Sheets, puis me donner l'URL de la feuille.

## Livrables en fin de travail
La ligne écrite pour hier, le nombre de jours rattrapés (53 attendus) et la liste des usages de `nombre_demandes`.
