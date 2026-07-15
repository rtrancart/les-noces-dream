## Brique 2 — Portail Stripe, résiliation programmée, relances impayés

Trois chantiers branchés sur l'existant (`abonnements`, `stripe-webhook`, `email_textes`, `send-transactional-email`). Aucun mécanisme parallèle : je réutilise le compteur `nb_echecs_paiement`, les statuts déjà en place et le circuit d'emails transactionnels.

---

### 1. Portail client Stripe (moyen de paiement + factures + résiliation)

Aujourd'hui les 3 CTA (« Modifier mon moyen de paiement », « Consulter mes factures », « Résilier / Réactiver ») appellent `portailStripeBientot()`. Je les branche sur le **Stripe Customer Portal**.

**Nouvelle edge function `stripe-create-portal-session`** :
- `verify_jwt = true`, vérifie le JWT, lit `abonnements.stripe_customer_id` du prestataire courant.
- `stripe.billingPortal.sessions.create({ customer, return_url: "${origin}/espace-pro/abonnement" })`.
- Retourne `{ url }`. Réutilise le même pattern anti-iframe que `subscribe` côté front (top nav + fallback + `StripeRedirectNotice`).

**Front `src/pages/prestataire/Abonnement.tsx`** :
- Nouvelle fonction `openStripePortal()` qui appelle l'edge function et redirige.
- Les 3 CTA pointent tous vers `openStripePortal()` (Stripe affiche factures + carte + résiliation dans la même vue).
- Suppression de `portailStripeBientot`.

**Résiliation en fin de période** : garantie côté Stripe par la config du portail (voir plus bas). Aucun code à écrire — Stripe passera `cancel_at_period_end = true` et `stripe-webhook` (déjà en place, `syncSubscription`) mettra `abonnements.statut = 'resilie'` + `cancel_at_period_end = true` + `resilie_le`. La fiche reste `actif` côté prestataire jusqu'à `current_period_end`.

**Fin effective de période** : `customer.subscription.deleted` sans motif impayé → déjà géré (`statut = 'expire'`). À vérifier au passage : côté `prestataires`, on doit repasser le statut à `suspendu` (ou équivalent) à ce moment-là, ce que le webhook actuel ne fait PAS dans la branche non-impayé. **Point à te signaler** (voir §Points ouverts).

---

### 2. Relances impayés — 3 emails max sur jalons

**Modèle mental** : Stripe Smart Retries → jusqu'à 8 événements `invoice.payment_failed` par impayé. On ne déclenche un email qu'aux 3 jalons : 1er échec, rappel J+7 si toujours impayé, suspension définitive.

**Champ manquant à créer** : la table `abonnements` a `nb_echecs_paiement` et `suspendu_pour_impaye_le`, mais aucun champ pour tracer l'envoi du rappel intermédiaire. Sans ce champ, impossible de garantir l'unicité du 2ᵉ email. Je propose d'ajouter :
- `premier_echec_le TIMESTAMPTZ NULL` — horodatage du tout premier échec (sert de base pour calculer J+7 et fenêtre d'impayé).
- `rappel_impaye_envoye_le TIMESTAMPTZ NULL` — flag anti-doublon pour le 2ᵉ email.

`nb_echecs_paiement = 0` sert déjà de garde pour le 1er email (n'envoyer que si `nb_echecs_paiement` était à 0 avant incrément). `suspendu_pour_impaye_le` sert de garde pour le 3ᵉ.

**Modification `stripe-webhook` → cas `invoice.payment_failed`** :

```text
récupérer l'abonnement courant (nb_echecs_paiement, premier_echec_le, rappel_impaye_envoye_le)
nb_avant = nb_echecs_paiement
nb_apres = nb_avant + 1
patch = { statut: 'en_retard', nb_echecs_paiement: nb_apres }
si nb_avant == 0:
   patch.premier_echec_le = now()
   → enqueue email jalon 1 (impaye-premier-echec)
sinon si rappel_impaye_envoye_le IS NULL
        ET premier_echec_le <= now() - interval '7 days':
   patch.rappel_impaye_envoye_le = now()
   → enqueue email jalon 2 (impaye-rappel-intermediaire)
sinon:
   → aucun email (tentatives intermédiaires silencieuses)
update abonnements SET patch
```

Le calcul J+7 se fait sur l'événement de paiement échoué qui tombe après le délai — pas besoin de cron : Stripe génère un `invoice.payment_failed` à chaque retry, l'un d'eux tombera nécessairement après J+7. Si la Smart Retry ne repasse pas exactement à J+7, l'envoi glissera légèrement (acceptable ; alternative avec cron possible si tu veux un timing précis, à décider).

**Modification `stripe-webhook` → cas `customer.subscription.deleted` (branche `failedForPayment`)** :
- Logique actuelle conservée (statut abonnement = `annule`, `suspendu_pour_impaye_le = now()`, prestataire → `suspendu`).
- **Ajout** : enqueue email jalon 3 (`impaye-suspension`).

**Modification `stripe-webhook` → cas `invoice.payment_succeeded`** :
- Logique actuelle conservée (statut = `actif`, `nb_echecs_paiement = 0`, réactivation).
- **Ajout** : reset des flags `premier_echec_le = null`, `rappel_impaye_envoye_le = null` pour armer proprement le prochain cycle.

**Circuit d'envoi** : `supabase.functions.invoke('send-transactional-email', { templateName, recipientEmail, idempotencyKey, templateData })`. La table `email_textes` héberge les 3 textes (source de vérité). Tu me fourniras sujet/titre/intro/corps/CTA quand les templates existeront.

**Idempotency keys** (double filet en plus des gardes DB) :
- Jalon 1 : `impaye-premier-${prestataire_id}-${invoice.id}`
- Jalon 2 : `impaye-rappel-${prestataire_id}-${subscription.id}-${premier_echec_le}`
- Jalon 3 : `impaye-suspension-${prestataire_id}-${subscription.id}`

**3 nouveaux templates React Email** dans `supabase/functions/_shared/transactional-email-templates/` + inscription dans `registry.ts` :
- `impaye-premier-echec.tsx` → clé `impaye_premier_echec`
- `impaye-rappel-intermediaire.tsx` → clé `impaye_rappel_intermediaire`
- `impaye-suspension.tsx` → clé `impaye_suspension`

Squelettes vides prêts à recevoir tes textes ; CTA principal = lien vers `/espace-pro/abonnement` (les 2 premiers) / lien vers procédure de réactivation (le 3ᵉ, à préciser).

**Entrées correspondantes dans `email_textes`** : 3 lignes seed (sujet/titre/intro/corps/cta_label placeholder) que tu remplaceras.

---

### 3. Récap des fichiers touchés

| Fichier | Nature |
|---|---|
| `supabase/functions/stripe-create-portal-session/index.ts` | nouveau |
| `supabase/config.toml` | ajouter bloc `[functions.stripe-create-portal-session] verify_jwt = true` |
| `supabase/functions/stripe-webhook/index.ts` | étendre `invoice.payment_failed`, `invoice.payment_succeeded`, `customer.subscription.deleted` |
| `supabase/functions/_shared/transactional-email-templates/impaye-premier-echec.tsx` | nouveau |
| `supabase/functions/_shared/transactional-email-templates/impaye-rappel-intermediaire.tsx` | nouveau |
| `supabase/functions/_shared/transactional-email-templates/impaye-suspension.tsx` | nouveau |
| `supabase/functions/_shared/transactional-email-templates/registry.ts` | 3 entrées |
| Migration DB | `ALTER TABLE abonnements ADD COLUMN premier_echec_le TIMESTAMPTZ, ADD COLUMN rappel_impaye_envoye_le TIMESTAMPTZ` + 3 lignes seed dans `email_textes` |
| `src/pages/prestataire/Abonnement.tsx` | `openStripePortal()` sur les 3 CTA |

---

### 4. Vérifications

- Portail : clic « Modifier moyen de paiement » → Stripe Portal ouvre → carte mise à jour → retour, ligne carte à jour dans la page.
- Résiliation : clic « Résilier » → portail → annulation → retour, la page indique « Abonnement résilié — fin le JJ/MM », la fiche reste visible jusqu'à `fin_periode_le`, `customer.subscription.deleted` en fin de période bascule vers l'état résilié final.
- Impayé : simuler 3 `invoice.payment_failed` de suite → 1 seul email (jalon 1) au 1er, aucun aux 2ᵉ et 3ᵉ. Attendre >7j (ou tricher `premier_echec_le` en base pour tests) et rejouer un `payment_failed` → 1 email (jalon 2). Simuler `subscription.deleted` avec `cancellation_details.reason = 'payment_failed'` → 1 email (jalon 3) + fiche suspendue. `invoice.payment_succeeded` derrière → statut `actif`, flags remis à null.

---

### 5. Points ouverts à trancher avant l'implémentation

1. **Timing exact du rappel J+7** : je m'appuie sur le prochain `invoice.payment_failed` qui tombe après 7 jours (drift possible de quelques jours selon planning Smart Retries de Stripe). Alternative : cron quotidien qui scanne `abonnements WHERE statut='en_retard' AND rappel_impaye_envoye_le IS NULL AND premier_echec_le <= now() - '7 days'`. Simplicité vs précision — tu préfères quoi ?
2. **Statut `prestataires` en fin de période sans impayé** : aujourd'hui, dans `customer.subscription.deleted` branche non-impayé, on met l'abonnement à `expire` mais on **ne touche pas au statut du prestataire**. Est-ce voulu (la fiche reste visible malgré l'abandon d'abonnement) ou faut-il aussi suspendre la fiche à ce moment ?
3. **CTA du jalon 3** : lien vers `/espace-pro/abonnement` ou vers une procédure de réactivation dédiée ? Y a-t-il déjà une page/flow de réactivation post-suspension ?

---

### 6. Configuration Customer Portal côté dashboard Stripe

À faire une seule fois dans **Dashboard Stripe → Settings → Billing → Customer portal** (mode Test **et** mode Live séparément) :

**Business information**
- ☑ Business name : « Les Noces » (déjà rempli sans doute)
- ☑ Terms of service URL et Privacy URL : ceux du site.

**Functionality → Invoice history**
- ☑ **Show invoice history** = ON (permet consultation + téléchargement PDF).

**Functionality → Customer information**
- Laisser au minimum : email + adresse de facturation modifiables (utile pour factures conformes). Non critique.

**Functionality → Payment methods**
- ☑ **Allow customers to update their payment methods** = ON.
- ☑ **Allow customers to remove payment methods** = ON (au choix, sans impact).

**Functionality → Subscriptions → Cancel subscriptions**
- ☑ **Allow customers to cancel their subscriptions** = ON.
- Mode : **« At end of billing period »** (PAS « Immediately »). ← crucial pour que la fiche reste visible jusqu'à `fin_periode_le`.
- ☑ **Customer reason for cancellation** : optionnel, laisser ON pour la data.
- Prorations : sans objet quand on résilie en fin de période.

**Functionality → Subscriptions → Update subscriptions (changement de formule via le portail)**
- ☐ **Allow customers to switch plans** = **OFF**. ← désactivé, tu gères le changement de formule dans ton UI.
- ☐ **Allow customers to update quantities** = OFF.

**Functionality → Subscriptions → Pause subscriptions**
- ☐ = OFF (pas dans le périmètre).

**Products → Products the customer can switch to**
- Vide, puisque « switch plans » est OFF.

**Branding**
- Logo, couleurs de la marque (à ajuster selon la charte).

**Default return URL**
- `https://les-noces.lovable.app/espace-pro/abonnement` (ou custom domain quand configuré). Notre code passe déjà `return_url` explicite, donc ce champ sert de fallback.

Sauvegarder. À refaire en mode Live après validation en Test.
