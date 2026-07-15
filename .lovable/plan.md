## Brique 2 — Durcissement complet + portail Stripe en nouvel onglet (version finale)

Tes deux derniers arbitrages sont intégrés : les 3 colonnes `plan_pending*` sont créées, et l'enum `statut_prestataire` reçoit une nouvelle valeur dédiée `resilie_expire` pour la fin de résiliation volontaire.

---

## 1. Portail Stripe → nouvel onglet

`src/pages/prestataire/Abonnement.tsx`, refonte `openStripePortal()` :

- **Pré-ouverture synchrone au clic** : `const tab = window.open('', '_blank', 'noopener,noreferrer')` avant tout `await`.
- Appel `stripe-create-portal-session`.
- Si `tab` non-null → `tab.location.href = url`. Sinon → bannière `StripeRedirectNotice` variante « portail » (lien manuel `target="_blank" rel="noopener noreferrer"`).
- Toast : « Le portail Stripe s'est ouvert dans un nouvel onglet. Revenez ici après vos modifications, vos changements se mettront à jour automatiquement. »
- **Refresh au retour** (listeners `visibilitychange` + `focus`, armés à l'ouverture, désarmés après succès ou après épuisement) :
  - Snapshot avant ouverture : `stripe_payment_method_id`, `cancel_at_period_end`, `plan`, `montant_cents`, `carte_last4`, `plan_pending`.
  - Au premier retour : re-fetch `abonnements`. Si un champ pertinent a changé → maj UI + désarmement.
  - Sinon → 2 re-fetch supplémentaires à ~4 s puis ~10 s (fenêtre pour le webhook). Aucun délai fixe.
  - Après épuisement sans changement → désarmement silencieux. Pas de spam.
- Flux souscription initiale (`subscribe()` sur nouveau customer) : **inchangé**, redirection top-level.
- `StripeRedirectNotice` : mode `'portal' | 'checkout'` (libellé + target adaptés).

---

## 2. Changement de formule — upgrade immédiat / downgrade programmé

Rangs : `standard` (89 €) < `premium` (149 €) < `annuel` (79 €/mois, engagement 12 mois → rang supérieur).

Dans `supabase/functions/stripe-create-checkout/index.ts`, branche « sub existante » :

**Upgrade** :
```ts
stripe.subscriptions.update(primary.id, {
  items: [{ id: currentItem.id, price: newPriceId }],
  proration_behavior: 'always_invoice',
  billing_cycle_anchor: 'unchanged',
  cancel_at_period_end: false,
  metadata: { formule, prestataire_id, user_id },
});
```
→ facture de proration immédiate, accès supérieur immédiat.

**Downgrade** :
```ts
const schedule = await stripe.subscriptionSchedules.create({ from_subscription: primary.id });
await stripe.subscriptionSchedules.update(schedule.id, {
  end_behavior: 'release',
  phases: [
    { items: [{ price: currentItem.price.id, quantity: 1 }],
      start_date: primary.current_period_start, end_date: primary.current_period_end,
      proration_behavior: 'none' },
    { items: [{ price: newPriceId, quantity: 1 }],
      iterations: 1, proration_behavior: 'none',
      metadata: { formule, prestataire_id, user_id } },
  ],
});
// Puis on écrit dans DB pour l'UI :
UPDATE abonnements SET
  plan_pending = <plan cible>,
  plan_pending_le = to_timestamp(primary.current_period_end),
  stripe_schedule_id = schedule.id
WHERE id = ...;
```
→ aucun avoir, plan actuel conservé jusqu'à `fin_periode_le`, bascule automatique.

**Blocage impayé (B4)** :
- UI : si `abo.statut === 'en_retard'`, `MiniPlanCard` désactivés + message « Régularisez votre paiement avant de changer de formule. » + CTA `openStripePortal()`.
- Edge : si `activeSubs[0].status ∈ {past_due, unpaid}` → 409 `{ error: 'unpaid_subscription' }`.

**Nettoyage des colonnes `plan_pending*`** :
- Dans `stripe-webhook` cas `customer.subscription.updated` : si le plan **actuel** de la sub correspond à `plan_pending` (la bascule vient d'avoir lieu) → reset `plan_pending=null`, `plan_pending_le=null`, `stripe_schedule_id=null`.
- Idem sur `subscription_schedule.released` (Stripe libère le schedule à la bascule).
- Nouvelle edge function `stripe-cancel-scheduled-change` : `subscriptionSchedules.release(schedule_id)` + reset des 3 colonnes → utilisée par l'UI (« Annuler ce changement programmé »).
- Sécurité : si `stripe-create-checkout` détecte un `plan_pending` en cours et que l'utilisateur reclique sur un plan différent → `release` du schedule existant avant la nouvelle logique.

**UI — reflet du downgrade programmé** : dans le bloc « Votre abonnement », si `plan_pending && plan_pending_le`, encart info : « Passage à *[formule cible]* programmé pour le [date]. » + lien « Annuler ce changement » qui appelle `stripe-cancel-scheduled-change`.

---

## 3. Résiliation volontaire — nouveau statut `resilie_expire` (C2)

**Migration** — ajouter la valeur d'enum :
```sql
ALTER TYPE public.statut_prestataire ADD VALUE 'resilie_expire';
```
Filtrable en admin, exploitable en CRM. Le `motif_suspension` reste peuplé en complément descriptif mais n'est plus le discriminant.

**Moment 1 — résiliation programmée** (`subscription.updated` avec `cancel_at_period_end=true`) : inchangé. `abonnements.statut='resilie'`, `cancel_at_period_end=true`, `resilie_le=now()`. Fiche reste `actif`.

**Moment 2 — expiration effective** (`subscription.deleted` non-impayé) :
- `abonnements.statut='expire'`, `cancel_at_period_end=false`.
- `prestataires.statut = 'resilie_expire'`, `motif_suspension = 'Abonnement résilié — fin de période atteinte'`.

Cas impayé (déjà en place) reste : `prestataires.statut='suspendu'`, motif « Abonnement définitivement abandonné pour impayé ».

**Point de vigilance** : la mémoire projet dit « `actif` ne peut être écrit que par les triggers DB ». La contrainte `prevent_direct_actif_write` (§db-functions) porte uniquement sur `'actif'` → écrire `'resilie_expire'` depuis le webhook est autorisé sans `set_config`. Idem pour `'suspendu'`.

**Vérifier côté queries publiques** : les endpoints qui listent les prestataires visibles filtrent aujourd'hui sur `statut = 'actif'`. Le nouveau `'resilie_expire'` est de facto exclu → fiche non visible, comportement attendu. Aucune modification de RLS/queries publiques nécessaire, mais je passerai vérifier `PrestatairesListe.tsx` / `Recherche.tsx` / `FichePrestataire.tsx` pour confirmer qu'aucune ne whiteliste implicitement `resilie_expire`.

**Impact admin** : les listings admin (`src/pages/admin/Prestataires.tsx`) filtrent probablement par statut — j'ajouterai `resilie_expire` aux libellés / filtres pour qu'il soit filtrable proprement.

---

## 4. Rappel J+7 impayé — cron déterministe (D3)

- **`stripe-webhook`, cas `invoice.payment_failed`** : suppression du bloc `else if (…7 jours…) sendJalon2 = true`. Le webhook ne gère plus que le jalon 1 (1er échec) et laisse la suite au cron. Garde D7 conservée : ignorer si `suspendu_pour_impaye_le IS NOT NULL` ou `statut IN ('annule','expire','resilie_expire')`.
- **Nouvelle edge `cron-relance-impaye-j7/index.ts`** :
  ```ts
  const { data } = await supabase.from('abonnements').select('id, prestataire_id, stripe_subscription_id, premier_echec_le')
    .eq('statut','en_retard')
    .not('premier_echec_le','is',null)
    .lte('premier_echec_le', new Date(Date.now() - 7*24*3600e3).toISOString())
    .is('rappel_impaye_envoye_le', null)
    .is('suspendu_pour_impaye_le', null);
  for (const row of data ?? []) {
    // update AVANT enqueue → garde anti-doublon en cas de re-run
    await supabase.from('abonnements').update({ rappel_impaye_envoye_le: new Date().toISOString() }).eq('id', row.id).is('rappel_impaye_envoye_le', null);
    await enqueueImpayeEmail(row.prestataire_id, 'impaye_rappel_intermediaire', { idempotencyKey: `impaye-rappel-${row.prestataire_id}-${row.stripe_subscription_id}-${row.premier_echec_le}` });
  }
  ```
- **Planification** via `insert` SQL (donnée user-specific, pas migration) :
  ```sql
  select cron.schedule('cron-relance-impaye-j7','0 9 * * *',$$
    select net.http_post(url:='https://<project>.supabase.co/functions/v1/cron-relance-impaye-j7', ...);
  $$);
  ```

---

## 5. Webhook — événements manquants (A7 + downgrade)

Ajouts code dans `supabase/functions/stripe-webhook/index.ts` :
- `customer.updated` : détecter changement `invoice_settings.default_payment_method` → resolve PM → maj carte via `updateCardByCustomer`.
- `payment_method.detached` : si PM détaché == `stripe_payment_method_id` stocké, reset `carte_brand`/`carte_last4`/`stripe_payment_method_id` à null.
- `subscription_schedule.updated` : sync `plan_pending*` si nécessaire (ceinture — normalement déjà écrit à la création du schedule par `stripe-create-checkout`).
- `subscription_schedule.released` : reset `plan_pending`, `plan_pending_le`, `stripe_schedule_id` à null pour la ligne concernée.
- `syncSubscription` — **fix reset `resilie_le`** : quand `cancel_at_period_end` repasse de `true` à `false`, mettre explicitement `resilie_le = null` (aujourd'hui la valeur reste, bug de réactivation).

---

## 6. Migration DB

```sql
-- 1. Nouvelle valeur d'enum pour prestataires
ALTER TYPE public.statut_prestataire ADD VALUE 'resilie_expire';

-- 2. Colonnes de downgrade programmé
ALTER TABLE public.abonnements
  ADD COLUMN plan_pending public.plan_abonnement NULL,
  ADD COLUMN plan_pending_le TIMESTAMPTZ NULL,
  ADD COLUMN stripe_schedule_id TEXT NULL;
```
(À valider : type exact de la colonne `plan` — je le lis avant de générer la migration pour matcher.)

---

## 7. Fichiers touchés

| Fichier | Nature |
|---|---|
| `src/pages/prestataire/Abonnement.tsx` | Nouvel onglet + refresh échelonné, blocage impayé, encart downgrade programmé + bouton annuler |
| `src/pages/admin/Prestataires.tsx` | Ajout du statut `resilie_expire` aux libellés/filtres |
| `src/integrations/supabase/types.ts` | Regénéré automatiquement par la migration |
| `supabase/functions/stripe-create-portal-session/index.ts` | Try/catch `resource_missing` → 404 propre |
| `supabase/functions/stripe-create-checkout/index.ts` | Upgrade `always_invoice` / Downgrade via `subscriptionSchedules` + peuplement `plan_pending*` + release d'un schedule existant si l'utilisateur revient dessus + garde `unpaid` |
| `supabase/functions/stripe-webhook/index.ts` | +`customer.updated`, +`payment_method.detached`, +`subscription_schedule.updated`, +`subscription_schedule.released`, retrait du jalon 2, `resilie_expire` sur fin résiliée, reset `plan_pending*` à la bascule, fix `resilie_le=null` sur réactivation, garde D7 |
| `supabase/functions/cron-relance-impaye-j7/index.ts` | **nouveau** |
| `supabase/functions/stripe-cancel-scheduled-change/index.ts` | **nouveau** |
| Migration DB | enum + 3 colonnes (§6) |
| Insert SQL | `cron.schedule('cron-relance-impaye-j7', ...)` |
| `mem://index.md` + `mem://logic/statuts-prestataires` | ajout de la valeur `resilie_expire` |

---

## 8. Récap cas couverts

**A** Portail : A1 CTA désactivés sans customer / A2 customer supprimé → 404 / A3 popup bloquée → bannière / A4 auto-clear / A5 résiliation OK / A6 undo résiliation (fix `resilie_le`) / A7 carte via `customer.updated`+`payment_method.attached` / A8 refresh échelonné / A9 double-clic verrouillé.

**B** Changement formule : B1 upgrade facturé immédiat / B2 downgrade programmé sans avoir / B3 essai (trial_end préservé, à valider) / B4 bloqué pendant impayé / B5 réactivation via changement / B6-B7-B9 Checkout / B8 doublons annulés.

**C** Résiliation : C1 fiche visible pendant programmée / C2 `resilie_expire` à l'expiration / C3 réactivation avant expiration.

**D** Impayés : D1 jalon 1 (webhook) / D2 retries silencieux / D3 **jalon 2 via cron déterministe** / D4 reset flags au succès / D5 jalon 3 sur suppression pour impayé / D6 gardes DB + idempotency / D7 ignorer événements sur sub morte.

**E** Cohérence webhook : E1/E2/E3 couverts par `isCurrentOrClaimableSubscription` (déjà en place).

---

## 9. ⚠️ À COCHER DANS L'ENDPOINT WEBHOOK STRIPE (Test **et** Live)

Ton endpoint est aujourd'hui abonné à 6 événements. Coche les événements manquants pour que le code correspondant côté serveur reçoive quelque chose. Liste complète cible :

1. `checkout.session.completed`
2. `customer.subscription.created`
3. `customer.subscription.updated`
4. `customer.subscription.deleted`
5. `invoice.payment_succeeded`
6. `invoice.payment_failed`
7. **`payment_method.attached`** ← à ajouter si absent
8. **`payment_method.detached`** ← à ajouter (ceinture, carte fantôme)
9. **`customer.updated`** ← à ajouter (default_payment_method modifié via portail)
10. **`subscription_schedule.updated`** ← à ajouter (downgrade programmé)
11. **`subscription_schedule.released`** ← à ajouter (bascule effective ou annulation d'un schedule)

À faire en **Test** puis en **Live**. Sans ces événements cochés côté dashboard, le code correspondant restera muet.
