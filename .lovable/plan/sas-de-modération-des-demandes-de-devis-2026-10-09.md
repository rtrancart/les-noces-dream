# Sas de modération des demandes de devis

## 0. État des lieux (vérifié)

**Stockage et insertion**
- Table `demandes_devis` (1 seule ligne aujourd'hui). Aucun champ code INSEE : la règle « lieu non reconnu » est ignorée pour l'instant.
- Insertion par la fonction en base `soumettre_demande_devis` (appelée depuis `FicheDevisSidebar.tsx` et `FicheDevisDialog.tsx`). Elle vérifie que la fiche est active, crée ou met à jour `contacts_anonymes`, puis insère la demande.
- Une règle d'accès permet aussi à n'importe qui d'insérer directement dans la table (fiche active). Comme le contrôle se fera par trigger, il s'appliquera aussi à cette voie.
- `nombre_invites_rang` est un texte (tranche saisie), pas un nombre.

**Email au prestataire**
- Fonction `notify-nouveau-contact-presta`, appelée **depuis le navigateur** après l'insertion, et seulement par `FicheDevisDialog`. **`FicheDevisSidebar` ne l'appelle pas** : les demandes passées par la colonne latérale de la fiche ne déclenchent aujourd'hui aucun email au prestataire.
- La fonction est appelable sans connexion, avec n'importe quel identifiant de demande, sans garde-fou contre un renvoi.

**Autres déclencheurs à l'insertion**
- `trg_brevo_sync_contact` (AFTER INSERT) : pousse le contact vers Brevo.
- `trg_score_demandes` (AFTER INSERT) : recalcule `score_classement`.

**Dashboard prestataire**
- Requêtes : `prestataire/Dashboard.tsx` (total, nouvelles), `prestataire/Demandes.tsx` (liste), `PrestataireSidebar.tsx` (badge non lus).
- Règle de lecture « Participants can view demandes » : le client auteur, le propriétaire de la fiche ou un admin. Même logique pour la mise à jour par le prestataire, pour les règles de `messages` (lecture, envoi, mise à jour) et pour le canal temps réel des conversations.

**Score et compteurs qui lisent la table**
- `calculer_taux_reponse` (demandes des 90 derniers jours, utilisée par le cron du taux de réponse, qui alimente la réactivité du score).
- `trg_score_demandes`, `trg_score_messages`.
- `brevo_compteurs_prestataires` (compteur NB_DEMANDES envoyé à Brevo).
- `can_review_prestataire` (prérequis « avoir demandé un devis » pour laisser un avis).
- `calculer_score_classement_for_row` ne lit pas directement la table : il se sert de `taux_reponse` déjà stocké.

## 1. Modèle de données (migration)
- `demandes_devis` : `moderation` (text, CHECK valide/a_verifier/rejete, NOT NULL, default 'valide'), `score_suspicion` int default 0, `raisons_suspicion` text[] default '{}', `moderee_le`, `moderee_par`, `email_prestataire_envoye_le`, `email_admin_envoye_le`. `statut` n'est pas modifié.
- La règle d'accès « Anyone can create demande for active prestataire » est supprimée. L'insertion passe uniquement par `soumettre_demande_devis`, et les deux formulaires sont testés.
- La seule ligne existante passe en 'rejete', avec `email_prestataire_envoye_le = created_at`. On recalcule ensuite `taux_reponse` et `score_classement` du prestataire concerné.
- Index : (lower(email_contact), created_at), (téléphone normalisé, created_at), (prestataire_id, lower(email_contact), created_at).
- Table `domaines_email_jetables (domaine text primary key)`, préremplie avec une trentaine de domaines courants. Lecture et écriture réservées aux admins.

## 2. Trigger BEFORE INSERT : doublon et suspicion
- **Doublon** : même prestataire, même email OU même téléphone normalisé, dans les 24 dernières heures → erreur dédiée `DEMANDE_DOUBLON`. Les deux formulaires affichent : « Vous avez déjà contacté ce prestataire, il reviendra vers vous rapidement. » C'est la seule modification des formulaires, en plus du retrait de l'appel d'envoi d'email.
- **Normalisation du téléphone** : suppression des espaces, points et tirets ; `00` remplacé par `+` ; un `0` suivi de 9 chiffres → +33. Le numéro est comparé au préfixe le plus long de la liste autorisée (+33, +262, +590, +594, +596, +508, +681, +687, +689, +32, +41, +352, +377).
- **Barème** : indicatif hors liste +3 ; domaine jetable +3 ; plus de 40 demandes du même email en 24 h +2 ; moins de 15 s depuis la dernière demande du même email +2 ; plus de 500 invités +1 (le plus grand nombre lu dans la tranche) ; message sans espace +2. Chaque point ajouté enregistre sa raison en clair.
- Score ≥ 3 → 'a_verifier', sinon 'valide'. Seul le trigger décide.

## 3. Envoi des emails, géré par la base
- Trigger AFTER INSERT/UPDATE OF moderation :
  - 'valide' et `email_prestataire_envoye_le` vide → appel en tâche de fond de `notify-nouveau-contact-presta` ;
  - 'a_verifier' et `email_admin_envoye_le` vide → appel de l'envoi de l'alerte admin.
- **Garde-fou** : la fonction réserve d'abord l'envoi de façon atomique (« pose la date seulement si vide », sinon arrêt). Elle met ensuite l'email en file. Si la mise en file échoue, elle remet le champ à NULL. La date ne reste donc posée que si l'envoi a réussi.
- La fonction n'accepte que l'appel interne (clé de service). L'appel depuis `FicheDevisDialog` est retiré, ce qui comble aussi l'absence d'email pour la colonne latérale.
- **Alerte admin** : nouveau gabarit `alerte_demande_suspecte` (prestataire, contact, raisons, lien `/admin/demandes?demande=<id>`), envoyé à **[adresse à confirmer]**.
- **Brevo** : synchronisation uniquement pour les demandes 'valide', à l'insertion ou lors d'un passage ultérieur à 'valide'.
- **Rattrapage sans nouveau cron** : la tâche nocturne existante `recalcul-scores-nightly` (03:20 UTC) appelle aussi une nouvelle fonction `rattraper_emails_demandes()`. Celle-ci cherche les demandes 'valide' sans `email_prestataire_envoye_le` et les demandes 'a_verifier' sans `email_admin_envoye_le`. Elle n'appelle la fonction d'envoi que s'il y a au moins une ligne, avec le même garde-fou anti-doublon.

## 4. Visibilité et score limités à 'valide'
- Règles d'accès : pour le propriétaire de la fiche, il faut `moderation = 'valide'` pour lire et mettre à jour les demandes, pour les messages et pour le canal temps réel. Le client auteur et l'admin gardent l'accès.
- Les 3 requêtes du dashboard prestataire ajoutent aussi le filtre.
- `calculer_taux_reponse`, `brevo_compteurs_prestataires` et `can_review_prestataire` ne comptent que les demandes 'valide'.
- Changement de modération : recalcul de `taux_reponse` et `taux_reponse_nb_demandes_90j`, puis de `score_classement`. À l'insertion, le score n'est recalculé que pour une demande 'valide'.

## 5. Tests (sur l'aperçu, données de test supprimées ensuite)
1. +33, Bordeaux, 120 invités, message normal → 'valide', email prestataire envoyé.
2. +226 et message d'un seul mot → 'a_verifier' (score 5), pas d'email prestataire, alerte admin envoyée, demande invisible avec une session prestataire.
3. Même email, même prestataire, deux fois → la deuxième est refusée avec le message de doublon.
4. Même email vers 5 prestataires à une minute d'intervalle → les 5 sont 'valide'.
5. Passage manuel de 'a_verifier' à 'valide' → un seul email prestataire, taux et score recalculés.
6. Échec d'envoi simulé → champ remis à NULL ; le rattrapage lancé à la main envoie l'email, et un second lancement n'envoie rien.
7. Les deux formulaires fonctionnent toujours ; une insertion directe dans la table est refusée.

## Point à confirmer
- Adresse de l'alerte admin rodolphe@lesnoces.net.
