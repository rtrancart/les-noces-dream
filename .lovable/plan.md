
## Contexte / diagnostic

Aujourd'hui `abo.plan` stocké en base vaut `standard_mensuel`, `premium_mensuel` ou `annuel` (mappé côté webhook Stripe). Or dans la page `Abonnement.tsx`, on cherche ces valeurs dans un dictionnaire `FORMULES` dont les clés sont `standard` / `premium` / `annuel`. Résultat :
- Le nom affiché tombe sur le fallback `abo.plan` brut → l'utilisateur voit `standard_mensuel`.
- La comparaison "formule actuelle" (`abo.plan === f`) est toujours fausse → le CTA n'est jamais grisé et on peut re-souscrire à la formule déjà en cours.

Les deux problèmes viennent de la même cause : mismatch entre `plan` (DB) et `formule` (clé UI).

---

## Option retenue pour récupérer un nom lisible

Trois pistes possibles, de la plus simple à la plus riche :

1. **Mapping frontend (retenu)** — Ajouter côté page une table `PLAN_TO_FORMULE: Record<string, Formule>` qui traduit `standard_mensuel → standard`, `premium_mensuel → premium`, `annuel → annuel`. On réutilise ensuite le libellé humain déjà défini dans `FORMULES[formule].label` ("Standard", "Premium", "Annuel"). Zéro impact backend, zéro migration, cohérent avec le mapping inverse `PLAN_BY_FORMULE` déjà présent dans le webhook.
2. Ajouter une colonne `nom_formule` (text) dans `abonnements`, hydratée par le webhook depuis `price.nickname` ou `product.name` Stripe. Plus riche mais nécessite migration + réémission d'événements pour peupler l'existant.
3. Récupérer le nom depuis Stripe à la volée côté edge function. Coûteux (appel réseau à chaque affichage), non retenu.

Je propose **l'option 1**. Elle est immédiate, réversible, et si un jour on veut des libellés dynamiques on migrera vers l'option 2 sans casser l'UI.

## Changements à apporter dans `src/pages/prestataire/Abonnement.tsx`

1. Ajouter en haut du fichier :
   ```ts
   const PLAN_TO_FORMULE: Record<string, Formule> = {
     standard_mensuel: "standard",
     premium_mensuel: "premium",
     annuel: "annuel",
   };
   function planToFormule(plan: string): Formule | null {
     return PLAN_TO_FORMULE[plan] ?? (plan in FORMULES ? (plan as Formule) : null);
   }
   ```
   Le fallback `plan in FORMULES` couvre le cas où la valeur serait déjà normalisée (ex : ancien enregistrement, tests).

2. Dans `GestionAbonnement` : remplacer `const formule = FORMULES[abo.plan as Formule]` par
   ```ts
   const formuleKey = planToFormule(abo.plan);
   const formule = formuleKey ? FORMULES[formuleKey] : null;
   const isPremium = formuleKey === "premium";
   ```
   Les affichages `formule?.label ?? abo.plan` restent, mais tombent désormais sur "Standard" / "Premium" / "Annuel". `formatMontant` gagne aussi le passage par `planToFormule` pour son fallback prix.

3. Dans la section "Changer de formule" : `MiniPlanCard` reçoit désormais `isCurrent={formuleKey === f}` au lieu de `abo.plan === f`. Le composant gère déjà :
   - `disabled={disabled || isCurrent}` sur le `<button>` (empêche le clic),
   - libellé "Formule actuelle" + badge "Actuelle",
   - style grisé via `bg-muted text-muted-foreground` et `disabled:cursor-not-allowed`.
   Rien à ajouter côté composant : la comparaison corrigée suffit à activer le comportement souhaité.

Aucun changement backend, aucune migration.

## Vérification

- Recharger `/espace-pro/abonnement` avec un abonnement `standard_mensuel` → le titre affiche "Standard", le badge "Formule Standard", et dans "Changer de formule" la carte Standard est grisée, CTA non cliquable ; Premium et Annuel restent actifs.
- Répéter avec `premium_mensuel` et `annuel` pour valider les trois cas.
