# Exemption charte de 90 jours à la validation des fiches migrées

## Objectif
Quand une fiche issue de la migration est validée via « Valider & inviter », elle doit devenir immédiatement visible au public et disposer de 90 jours pour signer la Charte Qualité. Passé ce délai sans signature, la fiche est suspendue automatiquement (cron déjà en place).

## Règles retenues
- Délai : 90 jours à compter de l'instant de la validation.
- Périmètre : uniquement les fiches `origine = migration` sans charte signée et sans exemption déjà posée.
- Une exemption reste immuable : si une fiche a déjà une date, elle est laissée telle quelle (pas de renouvellement).
- À l'échéance, le cron existant suspend la fiche avec le motif « charte non signée » et envoie l'email de suspension.

## Ce qui sera fait

### 1. Fonction base de données dédiée
Nouvelle fonction sécurisée `valider_prestataire_migre(p_prestataire_id)` qui, en une seule opération :
- vérifie que l'appelant est admin ou super_admin,
- vérifie que la fiche est bien d'origine migration, sans charte signée et sans exemption existante,
- pose `charte_exemptee_jusqua = now() + 90 jours` (en activant le drapeau interne autorisant l'écriture de l'exemption),
- passe le statut à `validee`, ce qui laisse le trigger existant basculer la fiche en `actif` puisque l'exemption est désormais valide,
- retourne la fiche mise à jour (statut, slug, nom commercial, email de contact, identifiant utilisateur) pour la suite du traitement.

### 2. Action groupée « Valider & inviter »
`src/lib/admin/bulkValidateInvite.ts` appellera cette fonction à la place de la mise à jour directe du statut pour les fiches migrées. Le reste de la chaîne est inchangé : email de publication si la fiche passe en `actif`, puis invitation par l'edge function existante avec lien longue durée, journalisation admin et rapport détaillé.

### 3. Retour utilisateur
Le rapport de l'action groupée mentionnera la date d'échéance d'exemption appliquée, et la colonne existante de la liste admin continuera d'afficher l'état de la charte.

## Détails techniques
- L'écriture de `charte_exemptee_jusqua` passe obligatoirement par le drapeau `app.allow_exemption_write` posé dans la transaction de la fonction, conformément au trigger `prevent_direct_exemption_write`.
- Le passage en `actif` reste le fait des triggers DB (`charte_ok_pour_publication`) — aucune écriture directe du statut `actif` côté client.
- Aucune modification de `cron-fin-exemption-charte` : il traite déjà les exemptions expirées sans signature.
