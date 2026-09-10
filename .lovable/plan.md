# Dashboard admin de suivi des emails

## Analyse des 8 échecs (résolu, aucune action requise)

Les 8 envois en échec définitif (`dlq`) + 1 rebond sont tous des artefacts de test historiques :

- **4 échecs (mai 2026)** — `domain_not_verified` / `Emails disabled` : le domaine d'envoi n'était pas encore configuré à l'époque. Destinataires de test (`test-reactivation@lesnoces.net`, `mail-tester.com`, `testprestalesnoces@gmail.com`).
- **3 échecs (2 sept. 2026)** — `recipient_mismatch` sur `rodolphe.trancart+migration@gmail.com` (relances migration M02/M03/M04) : erreur d'appel API lors des tests, destinataire = toi.
- **1 rebond (26 août 2026)** — `chloe.petit@example.com` : adresse de test inexistante, comportement normal.

**Conclusion : aucun vrai prestataire affecté, la chaîne d'envoi est saine.** Aucune action corrective.

## Ce qui existe déjà

- Journal d'envoi complet (destinataire, template, statut, erreur, date) avec statuts : envoyé, échec définitif, rebond, plainte spam, désinscrit.
- Rebonds et plaintes remontent automatiquement et coupent tout envoi futur vers l'adresse.
- Une fonction de lecture existe déjà côté serveur (`get_email_logs_for_recipient`).

**Non mesurable** (limite de l'infrastructure actuelle, hors scope) : taux d'ouverture et taux de clic — nécessiteraient un pixel de tracking et des liens trackés, non supportés.

## Page « Suivi des emails » dans l'admin

Nouvelle page `/admin/emails`, **réservée aux admins** (elle contient des données sensibles : adresses email des destinataires, détails d'erreurs). Ajout d'une entrée dans le menu admin.

### 1. Cartes de synthèse (haut de page)
Compteurs dédupliqués par email (un email = un statut final) pour la période/filtres actifs :
- Total envoyés
- Délivrés (vert)
- Échecs (rouge)
- Rebonds / plaintes / désinscriptions (jaune/orange)

### 2. Filtres
- **Période** : boutons 24 h / 7 jours / 30 jours + sélecteur de dates personnalisé (défaut : 7 jours).
- **Type d'email** : liste déroulante multi-sélection alimentée par les templates réellement présents dans le journal (invitation_prestataire, migration_m0x_relance, etc.) + « Tous ».
- **Statut** : Tous / Délivré / Échec / Rebond / Plainte / Désinscrit, avec badges colorés.

### 3. Tableau des envois
Une ligne par email unique (dédupliqué, dernier statut connu) :
Template | Destinataire | Statut (badge) | Date | Erreur (si échec)

Tri par date décroissante, colonnes triables, pagination à 50 lignes.

## Détails techniques

- **Migration SQL** : fonction `SECURITY DEFINER` `get_email_dashboard(p_since, p_until, p_templates, p_status, p_limit, p_offset)` qui déduplique par `message_id` (`DISTINCT ON ... ORDER BY created_at DESC`), retourne lignes paginées + compteurs agrégés ; garde `has_role(auth.uid(), 'admin'|'super_admin')` ; `GRANT EXECUTE` à `authenticated`. Lecture seule, aucune donnée modifiée.
- **Frontend** : `src/pages/admin/SuiviEmails.tsx` — cartes stats (composants Card existants), filtres (Select/Calendar shadcn), tableau paginé ; enregistrement de la route dans le routeur admin avec la même protection que les autres pages admin ; entrée de menu dans la navigation admin.
- **Style** : charte existante (doré/champagne, Montserrat), badges statut colorés.

## Vérifications

- `bunx tsc --noEmit` sans erreur.
- Requête de la fonction avec le compte super_admin : compteurs cohérents avec les chiffres connus (98 délivrés, 8 échecs, 1 rebond sur l'historique complet).
- Contrôle qu'un compte non-admin reçoit bien un refus.
