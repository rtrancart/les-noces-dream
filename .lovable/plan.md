## Plan validé, ajusté avec tes 3 précisions

### A. `relay-message/index.ts`
- Retirer `signMagicToken`, `MAGIC_SECRET`, import `djwt`, variable `magic`, paramètre `?token=`.
- Lire `PUBLIC_SITE_URL` depuis l'env (avec fallback `https://lesnoces.net`), au lieu d'écrire l'URL en dur.
- CAS A → `${SITE_URL}/mon-compte/messagerie?demande=:id`
- CAS C → `${SITE_URL}/espace-pro/demandes?demande=:id`
- CAS B inchangé (`/inscription?email=…&demande_id=…`).

### B. `notify-nouveau-contact-presta/index.ts`
- `lienConversation` : `/pro/messages/:id` → `/espace-pro/demandes?demande=:id` (utilise déjà `PUBLIC_SITE_URL`, OK).

### C. `notify-charte-version-update/index.ts`
- `magic_link` : `/espace-pro/charte` → `/pro/charte`.

### D. `request-reactivation-archive/index.ts`
- `lien_backoffice` : `/admin/prestataires/:id` → `/admin/prestataires?focus=:id` (URL valide dès aujourd'hui, param ignoré côté front, ré-utilisable le jour où on implémentera le focus programmatique — pas de régression sur les emails déjà envoyés).

### E. Uniformisation `PUBLIC_SITE_URL` (maintenant, pas plus tard)
Passage en revue de toutes les Edge Functions qui composent une URL publique. Seule `relay-message` a l'URL en dur (`https://lesnoces.net/...`). Les autres (`notify-nouveau-contact-presta`, `notify-charte-version-update`, `notify-nouvelle-soumission`, `request-reactivation-archive`, `invite-prestataire`, `resend-magic-link`, `stripe-webhook`, `stripe-webhook-simulate`, `cron-relance-impaye-j7`, `cron-fin-exemption-charte`, `generate-sitemap`) lisent déjà `Deno.env.get("PUBLIC_SITE_URL")`. Après le fix de `relay-message`, toutes les fonctions sont alignées → un simple update du secret `PUBLIC_SITE_URL` suffira au basculement DNS.

**Note** : les CGV du site (`email-shell.ts`, header/footer emails) contiennent des liens `https://lesnoces.net/...` en dur, mais ce sont des liens vers des pages publiques marketing (Accueil, Prestataires, Connexion, mailto), pas des CTA d'action utilisateur. Hors scope de ce chantier — je ne les touche pas.

### F. Deep-link côté front — tolérant + persistant
`src/pages/client/Messagerie.tsx` et `src/pages/prestataire/Demandes.tsx` :
- Lire `?demande=` via `useSearchParams` au montage.
- Après chargement des demandes : si l'ID match, `setSelectedId(id)`. Sinon (demande supprimée / mauvais compte) : ne rien faire, afficher la liste, pas de toast ni d'erreur.
- **Ne pas nettoyer le param d'URL** après sélection — le refresh préserve la conversation ouverte.

### G. Déploiement
Redéployer : `relay-message`, `notify-nouveau-contact-presta`, `notify-charte-version-update`, `request-reactivation-archive`.

### H. Vérification post-déploiement — livrable obligatoire
Après build + déploiement, je régénère le **tableau complet des 15 lignes** (URL générée ↔ route déclarée ↔ verdict) en re-grepant les Edge Functions et en le comparant à `src/App.tsx`. Livraison inline dans ma réponse finale, pas juste « build OK ».

---

## Hors scope (validé)
- Pas de nouvelle route `/:id` dédiée (query param suffit).
- Pas de réintroduction d'accès pré-authentifié via JWT DIY. Si besoin un jour → réutiliser `invitation_tokens` + `auth-verify-email-token`.
- Pas de refonte des liens marketing dans `email-shell.ts`.

Bascule-moi en build mode quand tu es prêt.
