# Tunnel A : passage des relances à J+2 et J+4

## État confirmé (audit)

Le tunnel A contient bien **2 emails**, réservés aux prestataires **invités par un admin** (statut `pre_inscrit`, compte jamais connecté, hors fiches migrées) :

| Email | Déclencheur actuel | Cible | Planification |
|---|---|---|---|
| `relance_decouverte_j7` — « Votre profil vous attend toujours » | J+7 après envoi de l'invitation (magic link) | `pre_inscrit`, `premier_login_le` NULL, magic link envoyé il y a ≥ 7 j | Cron `cron-relance-decouverte-j7`, tous les jours à 8h00 UTC |
| `dernier_contact_tunnel_a` — « Dernier message concernant votre profil » | J+14 après envoi de l'invitation | mêmes critères, magic link envoyé il y a ≥ 14 j | Cron `cron-dernier-contact-tunnel-a-daily`, tous les jours à 8h30 UTC |

Le délai est calculé depuis la date d'envoi du magic link d'invitation (`magic_link_envoye_le`). Chaque email n'est envoyé qu'une fois (verrou en base). Les fiches migrées (chaîne M) ne sont pas concernées.

## Changement demandé

Passer la 1re relance de **J+7 à J+2** et la dernière relance de **J+14 à J+4**.

## Modifications

1. `supabase/functions/cron-relance-decouverte-j7/index.ts` : cutoff `7 j` → `2 j` (commentaire inclus).
2. `supabase/functions/cron-dernier-contact-tunnel-a/index.ts` : cutoff `14 j` → `4 j` (commentaire inclus).
3. Libellés d'affichage dans `email_textes` (display_name « J+7 » / « J+14 » → « J+2 » / « J+4 ») pour rester cohérent dans l'admin. Les noms techniques des templates restent inchangés (pas de renommage, aucun impact sur l'historique d'envoi).
4. Redéployer les deux fonctions.

## Hors périmètre

- Textes, sujets et contenus des emails : inchangés.
- Horaires des crons (8h00 / 8h30 UTC) : inchangés.
- Aucun impact sur les prestataires déjà relancés (verrous déjà posés) : ils ne recevront pas de doublon.

## Point d'attention

Les prestataires invités il y a entre 2 et 7 jours qui n'ont pas encore reçu de relance seront éligibles dès le prochain passage du cron après déploiement — c'est l'effet recherché.
