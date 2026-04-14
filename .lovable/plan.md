

## Statuts de messagerie actuels vs proposés

### Statuts actuels dans la base (enum `statut_demande`)
`nouveau`, `lu`, `en_discussion`, `devis_envoye`, `accepte`, `refuse`, `archive` — 7 valeurs.

### Proposition simplifiée (3 statuts visibles)

On garde l'enum existant tel quel (pas de migration) mais on regroupe l'affichage en 3 états logiques :

| Affichage | Statuts DB correspondants | Logique |
|-----------|--------------------------|---------|
| **Non lu** | `nouveau` | Nouveau message pas encore ouvert par le destinataire |
| **En discussion** | `lu`, `en_discussion` | Conversation active, tous les messages lus |
| **Clôturé** | `devis_envoye`, `accepte`, `refuse`, `archive` | Conversation terminée |

### Comportement

- **Passage automatique à "lu"** : quand le prestataire ouvre une demande pour la première fois (statut `nouveau` → `lu`)
- **Passage automatique à "en_discussion"** : quand un message est envoyé par l'un des participants (statut `lu` → `en_discussion`)
- **Retour à "Non lu"** : quand un nouveau message arrive et que le destinataire ne l'a pas encore lu (basé sur `lu_le` de la table `messages`, pas sur le statut de la demande — on affiche un badge "non lu" si le dernier message n'a pas été lu par le destinataire)
- **Clôturer** : le prestataire peut manuellement passer le statut à `devis_envoye`, `accepte`, `refuse` ou `archive` via un menu déroulant

### Implémentation

1. **Migration** : ajouter la politique UPDATE sur `demandes_devis` pour le prestataire propriétaire + politique UPDATE sur `messages` pour marquer `lu_le` + activer realtime sur `messages`

2. **Composant `ConversationThread.tsx`** : fil de messages avec envoi, realtime, marquage lu automatique

3. **Refonte `Demandes.tsx` (prestataire)** : liste + détail conversation, menu changement de statut, badge non lu

4. **Refonte `Messagerie.tsx` (client)** : liste + détail conversation, badge non lu

Les 3 statuts affichés (Non lu / En discussion / Clôturé) sont dérivés des valeurs existantes — aucun changement d'enum nécessaire.

