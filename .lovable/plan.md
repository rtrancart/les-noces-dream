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
- `demandes_devis` : `moderation` (text, CHECK valide/a_verifier/rejete, NOT NULL, default 'valide'), `score_suspicion` int default 0, `raisons_suspicion` text[] default '{}', `moderee_le`, `moderee_par`, plus `email_prestataire_envoye_le` et `email_admin_envoye_le`. `statut` n'est pas modifié.
- Les lignes existantes restent en 'valide' (valeur par défaut), et `email_prestataire_envoye_le = created_at` pour qu'elles ne soient jamais renvoyées.
- Index : (lower(email_contact), created_at), (telephone normalisé, created_at), (prestataire_id, lower(email_contact), created_at).
- Table `domaines_email_jetables (domaine text primary key)`, préremplie avec une trentaine de domaines courants. Lecture et écriture réservées aux admins.

## 2. Trigger BEFORE INSERT : doublon et suspicion
- **Doublon** : même prestataire, même email OU même téléphone normalisé, dans les 24 dernières heures → erreur dédiée `DEMANDE_DOUBLON` (code d'erreur propre). Les deux formulaires affichent : « Vous avez déjà contacté ce prestataire, il reviendra vers vous rapidement. » C'est la seule modification des formulaires.
- **Normalisation du téléphone** : suppression des espaces, points et tirets ; `00` remplacé par `+` ; `0` suivi de 9 chiffres (10 chiffres en tout) → +33. On compare ensuite au préfixe le plus long de la liste autorisée (+33, +262, +590, +594, +596, +508, +681, +687, +689, +32, +41, +352, +377).
- **Barème** : indicatif hors liste +3 ; domaine jetable +3 ; plus de 40 demandes du même email en 24 h +2 ; moins de 15 s depuis la dernière demande du même email +2 ; invités > 500 +1 (le plus grand nombre lu dans la tranche) ; message sans espace +2. Chaque point ajouté enregistre sa raison en clair.
- Score ≥ 3 → 'a_verifier', sinon 'valide'. Une valeur imposée par l'appelant est ignorée : seul le trigger décide.

## 3. Envoi des emails, géré par la base et non plus par le navigateur
- Nouveau trigger AFTER INSERT/UPDATE OF moderation : si 'valide' et `email_prestataire_envoye_le` vide, il appelle `notify-nouveau-contact-presta` en tâche de fond.
- La fonction pose d'abord `email_prestataire_envoye_le` de façon atomique (« seulement si vide »), puis envoie. Un double appel ne peut donc pas produire deux emails.
- La fonction n'accepte plus que l'appel interne (clé de service). L'appel depuis `FicheDevisDialog` est retiré, ce qui comble aussi l'absence d'email pour la colonne latérale.
- Passage en 'a_verifier' : envoi d'un email admin récapitulatif (prestataire, contact, raisons, lien `/admin/demandes?demande=<id>`), avec un nouveau gabarit `alerte_demande_suspecte` et le garde-fou `email_admin_envoye_le`.
- Brevo : `trg_brevo_sync_contact` n'est déclenché que pour 'valide', y compris lors d'un passage ultérieur à 'valide'. Ainsi, les adresses de robots n'entrent pas dans le CRM.

## 4. Visibilité et score limités à 'valide'
- Règles d'accès : la branche « propriétaire de la fiche » exige `moderation = 'valide'` pour la lecture et la mise à jour des demandes, pour les messages et pour le canal temps réel. Le client auteur et l'admin gardent l'accès.
- Les 3 requêtes du dashboard prestataire ajoutent aussi le filtre (défense en profondeur).
- `calculer_taux_reponse`, `brevo_compteurs_prestataires` et `can_review_prestataire` ne comptent que les demandes 'valide'.
- Changement de modération : on recalcule `taux_reponse` et `taux_reponse_nb_demandes_90j` du prestataire, puis `score_classement`. À l'insertion, `trg_score_demandes` ne s'exécute que pour une demande 'valide'.

## 5. Tests (sur l'aperçu, données de test supprimées ensuite)
1. +33, Bordeaux, 120 invités, message normal → 'valide', email prestataire dans le journal d'envoi.
2. +226 et message d'un seul mot → 'a_verifier' (score 5), pas d'email prestataire, email admin envoyé, invisible avec une session prestataire.
3. Même email, même prestataire, deux fois → la deuxième est refusée avec `DEMANDE_DOUBLON`.
4. Même email vers 5 prestataires à une minute d'intervalle → les 5 sont 'valide'.
5. Passage manuel en base de 'a_verifier' à 'valide' → un seul email prestataire (une seconde mise à jour n'en renvoie pas), taux et score recalculés.

## Points à confirmer
- **Destinataire de l'alerte admin** : contact@lesnoces.net ou rodolphe.trancart@gmail.com ?
- Je propose de ne pas pousser vers Brevo les demandes en attente ou rejetées (voir le point 3). D'accord ?
