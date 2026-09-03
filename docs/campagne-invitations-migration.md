# Campagne d'invitations — prestataires migrés

Document opérationnel pour le jour J. Il couvre les paramètres de débit
(`email_send_state`), la procédure de bascule, les seuils d'alerte et la
checklist avant / pendant / après campagne.

## 1. Chaîne d'envoi (rappel)

```text
Admin /admin/prestataires
  → action groupée « Valider & inviter » (plafond 200 / lancement,
    lots de 10 fiches espacés de 3 s)
    → RPC valider_prestataire_migre  (statut + exemption charte 90 j)
    → edge invite-prestataire        (token TTL 60 j)
      → send-transactional-email     (vérifie suppressed_emails, met en file pgmq)
        → process-email-queue        (débit piloté par email_send_state)
          → Mailgun → destinataire
            → bounce/plainte → handle-email-suppression → suppressed_emails
```

Deux étages de régulation distincts :

- **Alimentation de la file** : bornée côté action groupée (plafond + lots).
- **Livraison réelle** : bornée par `email_send_state`, table persistante lue
  à chaque passage du worker. C'est le seul levier à ajuster pendant la campagne.

## 2. Valeurs `email_send_state` recommandées

| Phase | `batch_size` | `send_delay_ms` | Débit approx. | Usage |
|---|---|---|---|---|
| Rodage (2 premiers runs) | 5 | 2000 | ~50 emails/min | Vérifier le taux de rejet sur un petit volume |
| Campagne | 10 | 1000 | ~120 emails/min | Rythme nominal du parc migré |
| Repli (rejets élevés ou `429`) | 5 | 5000 | ~30 emails/min | Protection de la réputation d'expéditeur |
| Retour à la normale (après campagne) | 10 | 200 | — | Valeurs nominales hors campagne |

Le débit indiqué est un ordre de grandeur : le worker traite un lot de
`batch_size` messages par passage, avec `send_delay_ms` entre deux envois, et
les emails d'authentification (connexion, mot de passe oublié) restent
prioritaires sur la file transactionnelle.

## 3. Procédure de bascule

Bascule en phase rodage :

```sql
update public.email_send_state
set batch_size = 5, send_delay_ms = 2000;
```

Bascule en phase campagne :

```sql
update public.email_send_state
set batch_size = 10, send_delay_ms = 1000;
```

Repli immédiat :

```sql
update public.email_send_state
set batch_size = 5, send_delay_ms = 5000;
```

Restauration après campagne :

```sql
update public.email_send_state
set batch_size = 10, send_delay_ms = 200;
```

Vérification de l'état courant :

```sql
select batch_size, send_delay_ms, retry_after_until, updated_at
from public.email_send_state;
```

`retry_after_until` non nul signifie que le worker est en cooldown après un
`429` : ne rien lancer tant qu'il n'est pas passé.

## 4. Seuils d'alerte

- **> 3 % de rejets sur un run** → suspendre la campagne, analyser les adresses
  concernées avant de reprendre.
- **`retry_after_until` renseigné** → cooldown en cours : attendre, puis
  repasser en phase repli.
- **Échecs d'invitation répétés dans le rapport de run** (colonne « Validée mais
  invitation échouée ») → arrêter, vérifier les logs de `invite-prestataire`.

Requête de contrôle des rejets récents :

```sql
select reason, count(*)
from public.suppressed_emails
where created_at > now() - interval '24 hours'
group by reason;
```

## 5. Checklist

**Avant la campagne**

- [ ] `email_send_state` en phase rodage.
- [ ] `retry_after_until` nul.
- [ ] `PUBLIC_SITE_URL` pointe bien sur le domaine servi.
- [ ] Filtre « Email rejeté » consulté : les fiches concernées sont écartées
      automatiquement, mais valent un coup d'œil.

**Pendant**

- [ ] Un lancement = 200 fiches maximum, onglet admin laissé ouvert.
- [ ] Après les 2 runs de rodage : contrôler le taux de rejet, puis passer en
      phase campagne.
- [ ] Suivre la cadence réelle dans **Connecteurs → Campagne invitations**.

**Après**

- [ ] Restaurer `batch_size = 10`, `send_delay_ms = 200`.
- [ ] Exporter/consulter le récapitulatif des runs.
- [ ] Traiter manuellement les fiches marquées « Email rejeté ».

## 6. Trace de cadence

Chaque exécution de l'action groupée écrit une ligne `logs_admin`
(`action = 'bulk_validate_invite'`) contenant `run_id`, horodatages, durée,
volumes (sélection / traitées / invitations envoyées / ignorées), les
paramètres de lissage client (`chunk_size`, `chunk_delay_ms`, `max_per_run`) et
les valeurs `email_send_state` en vigueur au démarrage du run. Le panneau
**Campagne invitations** de `/admin/connecteurs` agrège ces lignes (débit
effectif, cumul, reste estimé).
