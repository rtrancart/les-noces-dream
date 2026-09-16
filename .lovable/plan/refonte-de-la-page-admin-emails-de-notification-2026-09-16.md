# Refonte de la page admin « Emails de notification »

## Ce que j'ai vérifié en base et dans le code

- La table des textes est bien `email_textes` : `template_name`, `display_name`, `description`, `sujet`, `titre`, `intro`, `corps`, `cta_label`, `footer`, `corps_html`, `est_actif`, `variables_disponibles`, `created_at`, `updated_at`.
- **22 modèles** en base (et non 4), tous actifs : messagerie, invitations, tunnel A, chaîne migration M-01→M-05, charte, modération, impayés.
- À l'envoi, seuls **`sujet` et `corps_html`** sont lus. Les colonnes `titre`, `intro`, `corps`, `cta_label`, `footer` ne sont lues par personne (6 lignes les renseignent, sans effet).
- Les variables et les données d'exemple ne sont pas en base : elles viennent du registre de modèles côté serveur (`variables_disponibles` est une copie, alimentée par la fonction admin).
- La fonction `send-transactional-email` n'existe plus : l'envoi passe par `send-app-email`. `preview-transactional-email` existe mais est réservée à l'appelant interne Lovable (clé API), donc inutilisable depuis le navigateur.
- L'auteur de la dernière modification n'est pas conservé → non affiché (décision retenue).

## Décisions retenues

1. Le panneau n'édite que ce qui part réellement : **Objet** et **Sous-objet** (texte d'aperçu affiché après l'objet dans la boîte de réception), plus le **corps HTML**. Le sous-objet est ajouté en base et réellement injecté à l'envoi. Les champs Titre / Bouton / Introduction / Pied de page de la maquette ne sont pas affichés (ils n'auraient aucun effet).
2. Ajout d'une colonne **destinataire** (`client` / `prestataire` / `equipe`), renseignée une fois pour les 22 modèles et modifiable depuis le panneau.
3. Aucune donnée d'auteur affichée : l'état affiche « modifié · il y a X » ou « texte d'origine ».
4. Les 22 modèles sont affichés.

## Page `/admin/emails`

- Fil d'ariane « Contenu › Emails », titre « Emails de notification », sous-titre expliquant le remplacement des variables `{{clientNom}}` à l'envoi et l'en-tête / pied de page appliqués par la coquille commune.
- **4 tuiles** calculées depuis la base : Templates (22), Actifs (+ nb désactivés), Textes modifiés (+ nb à l'origine), Dernière modification (date relative).
- **Barre d'outils** : recherche (nom, clé, sujet) ; segments Destinataire (Tous / Client / Prestataire / Équipe) ; segments État (Tous / Modifiés / Texte d'origine / Désactivés) ; bascule Regroupement (par destinataire / sans regroupement). Tri cliquable sur Template et État.
- **Tableau** : Template (nom + clé en mono), Sujet, Destinataire (badge), État du texte, toggle Actif. Clic sur la ligne → panneau d'édition. Sur mobile, les lignes se replient en cartes empilées.
- **Note de bas de page** : un modèle désactivé n'est plus envoyé — `send-app-email` retombe silencieusement sur le contenu par défaut du code.

## Panneau latéral d'édition

- En-tête : nom + clé mono + destinataire, toggle Actif, fermeture. Plein écran sur mobile, drawer à droite avec voile sur desktop.
- Onglet **Textes** : notice de déclencheur (`description` quand renseignée) ; variables cliquables insérées dans le dernier champ actif ; champs **Objet** (obligatoire), **Sous-objet**, **Corps HTML**.
- Onglet **Aperçu** : rendu iframe du corps entouré de la coquille réelle (en-tête, logo, signature, pied), variables remplacées par les données d'exemple du registre.
- Onglet **Variables** : liste des variables transmises à l'envoi, avec leur valeur d'exemple.
- Pied : Aperçu, Envoyer un test, Annuler + Enregistrer désactivés hors modification, indicateur « modifié ». Toast de confirmation à l'enregistrement.

## Détails techniques

- **Migration** : `ALTER TABLE public.email_textes ADD COLUMN sous_objet text, ADD COLUMN destinataire text NOT NULL DEFAULT 'prestataire' CHECK (destinataire IN ('client','prestataire','equipe'))` ; mise à jour des 22 lignes avec le bon destinataire.
- **`send-app-email`** : lecture de `sous_objet` en plus de `sujet`/`corps_html`, substitution des variables, injection d'un bloc préheader masqué en tête du HTML rendu (avant `tagEmailLinks`). Aucune autre modification du flux (garde migration, coquille, UTM, journalisation).
- **`admin-email-textes`** : l'action `list` renvoie en plus `previewData` du registre et `sous_objet` ; l'action `send_test` est ajoutée (rendu + envoi via `send-app-email` vers l'adresse saisie, réservée aux admins).
- **Frontend** : réécriture de `src/pages/admin/Emails.tsx` + composant de panneau dédié ; tokens de la charte via les classes sémantiques existantes (fond ivoire, or `#A57D27`, marine, bordures champagne, mono JetBrains Mono pour les clés) ; aucune valeur en dur pour les données.

## Vérifications

- Typecheck.
- Lecture réelle des 22 lignes : compteurs des tuiles cohérents avec la base.
- Envoi d'un test sur un modèle et contrôle en base que l'objet et le sous-objet enregistrés sont bien ceux partis.
