# P1 — Modèle abonnement à deux dimensions et statut Premium dérivé

Périmètre strictement limité à la fondation : aucune modification des fonctions Stripe, de la vue publique, des futures fonctionnalités Premium ni des règles de limitation.

## Préalable à confirmer
Les 4 comptes à abonnement actif sont **toujours présents en base** (Test presta, Camille Thuille, Atelier Test Migration 2, Robe Atelier Marie). Le prompt les suppose supprimés. Deux options : je les supprime d'abord (annulation Stripe puis suppression complète, comme validé plus tôt), ou j'enchaîne sur P1 en les laissant — dans ce cas le trigger de dérivation passera « Robe Atelier Marie » en Premium automatiquement, ce qui est cohérent avec la nouvelle règle mais fait mentir la vérification « 0 Premium ». Je pars sur la suppression d'abord, sauf indication contraire.

## Étape 1 — Nettoyage
Remettre à zéro le statut Premium et la date de fin Premium sur les 7 fiches marquées à la main (dont 2 avec une date de fin). Aucune notification.
Vérification : plus aucune fiche marquée Premium, plus aucune date de fin Premium.

## Étape 2 — Nouvelles colonnes
- Deux nouveaux types : `formule_abonnement` (standard, premium) et `periodicite_abonnement` (mensuel, annuel).
- Deux colonnes sur `abonnements` : `formule` par défaut standard, `periodicite` par défaut mensuel, toutes deux obligatoires.
- Colonne `plan` conservée telle quelle, aucune écriture, aucune suppression.
- Index composite `(prestataire_id, formule, statut)`.
Vérification : les 3 231 lignes en essai portent standard/mensuel, `plan` inchangé.

## Étape 3 — Dérivation automatique du statut Premium
Fonction `sync_est_premium_from_abonnement()` (SECURITY DEFINER, `search_path = public`) : détermine le prestataire concerné, recalcule s'il possède au moins un abonnement `formule = premium` et `statut = actif`, et n'écrit sur la fiche que si la valeur change (`IS DISTINCT FROM`).
Trois déclencheurs sur `abonnements` : après insertion, après modification de `formule` ou `statut`, après suppression.
Contrôles de compatibilité : la fiche prestataire porte déjà 11 déclencheurs, dont plusieurs bloquants en écriture. Une écriture ciblée sur la seule colonne du statut Premium les traverse (ils sont limités aux colonnes statut, origine, exemption de charte, zones, région), mais elle réveille la synchronisation Brevo de la fiche, non filtrée par colonne — d'où la garde de non-écriture inutile, qui limite le déclenchement aux vrais changements.
Vérification : compteur Premium toujours à zéro ; test manuel d'insertion d'un abonnement Premium actif puis suppression, avec bascule vrai/faux observée.

## Étape 4 — Page d'accueil
Dans `src/pages/Index.tsx`, la sélection des prestataires mis en avant passe du filtre sur la date de fin Premium au filtre sur le statut Premium (requête ligne 79-85, mappage ligne 144, badge ligne 321). Nombre de cartes, tri par note et composants inchangés.
Comportement à vide déjà géré : la section se masque entièrement quand la liste est vide (`FeaturedProviders` retourne `null`, ligne 375). Sans aucun Premium actif, la page d'accueil n'affichera donc plus de section « coups de cœur » tant qu'aucun abonnement Premium n'est souscrit — comportement attendu, à valider.

## Étape 5 — Retrait du levier admin
Dans `src/pages/admin/Prestataires.tsx`, suppression des champs d'édition Premium et Fin Premium et de leur écriture (état ligne 110, chargement ligne 557, enregistrement ligne 637, bloc d'interface lignes 1333-1360), remplacés par une mention indiquant que le statut Premium découle automatiquement de l'abonnement en cours.
La colonne de date de fin Premium reste en base et dans la vue publique ; sa suppression est réservée à un lot ultérieur.

## Rapport final
Synthèse par étape, fichiers modifiés, objets de base créés, écarts éventuels, et confirmation que ni la colonne `plan` ni les fonctions Stripe n'ont été touchées.
