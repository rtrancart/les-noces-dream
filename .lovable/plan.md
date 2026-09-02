# Taux de réponse à 100 % par défaut : correction

## Ce qui se passe

Vérifié en base : la colonne `taux_reponse` a une valeur par défaut de **100**, et **3 261 fiches** sont à `100 %` avec **0 demande sur 90 jours**. Ce n'est donc pas un calcul, c'est la valeur d'initialisation posée à la création/import de la fiche.

Le dashboard prestataire, lui, affiche déjà « — » quand il n'y a pas de demande, parce qu'il regarde le nombre de demandes. La liste admin, elle, affiche le pourcentage brut : d'où le 100 % partout.

## Correction proposée

1. **Affichage admin** (`/admin/prestataires`) : afficher « — » (avec info-bulle « Aucune demande sur 90 j ») dès que le nombre de demandes sur 90 jours est à 0, au lieu d'un badge 100 %. Le filtre « taux < 70 % » ignore déjà ces fiches, il reste inchangé.
2. **Données** : passer `taux_reponse` à NULL pour toutes les fiches sans aucune demande sur 90 jours, et supprimer la valeur par défaut 100 de la colonne (nouvelle fiche = pas de taux tant qu'il n'y a rien à mesurer).
3. **Brevo** : l'attribut `TAUX_REPONSE` envoyait 100 pour ces fiches ; il enverra désormais 0 (comportement déjà prévu pour les valeurs nulles). À confirmer si tu préfères ne rien envoyer plutôt que 0.

## Détails techniques

- Migration : `ALTER TABLE public.prestataires ALTER COLUMN taux_reponse DROP DEFAULT;` puis `UPDATE ... SET taux_reponse = NULL WHERE COALESCE(taux_reponse_nb_demandes_90j,0) = 0;`
- `src/pages/admin/Prestataires.tsx` (~l. 1014) : condition d'affichage basée sur `taux_reponse != null && (taux_reponse_nb_demandes_90j ?? 0) > 0`.
- Aucun changement à `calculer_taux_reponse` ni au cron : ils renvoient déjà NULL quand il n'y a pas de demande.
