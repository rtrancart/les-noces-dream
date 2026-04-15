

## Module analytics centralisé (GA4 + Supabase)

### Objectif
Créer un module unique `src/lib/analytics.ts` qui envoie chaque événement à GA4 (si configuré) et/ou à Supabase (`evenements_prestataire`) selon le contexte. L'ID GA4 sera lu depuis `VITE_GA4_ID` — tant qu'il n'est pas défini, seul Supabase est utilisé.

### Fichiers à créer

**`src/lib/analytics.ts`**
- Fonction `initGA4()` : injecte dynamiquement le script gtag.js si `import.meta.env.VITE_GA4_ID` existe
- Fonction `trackEvent(name, params?, prestataireId?)` :
  - Appelle `window.gtag("event", name, params)` si GA4 est chargé
  - Insère dans `evenements_prestataire` si `prestataireId` est fourni

### Fichiers à modifier

| Fichier | Modification |
|---|---|
| `src/vite-env.d.ts` | Ajouter déclaration globale `gtag` |
| `src/main.tsx` | Appeler `initGA4()` au démarrage |
| `src/pages/FichePrestataire.tsx` | Ajouter `trackEvent("vue_profil")` au chargement ; remplacer insert direct `vue_telephone` par `trackEvent("affichage_telephone")` |
| `src/components/fiche/FicheStickyMobileCTA.tsx` | Remplacer insert direct par `trackEvent("affichage_telephone")` |
| `src/components/fiche/FicheDevisSidebar.tsx` | Ajouter `trackEvent("premier_contact")` après envoi réussi |
| `src/components/messaging/ConversationThread.tsx` | Ajouter `trackEvent("envoi_message")` après envoi (GA4 uniquement) |
| `src/pages/Recherche.tsx` | Ajouter `trackEvent("recherche", { categorie, lieu })` quand les résultats s'affichent |
| `src/pages/Inscription.tsx` | Ajouter `trackEvent("inscription", { role })` après succès |
| `src/pages/Connexion.tsx` | Ajouter `trackEvent("connexion")` après succès |

### Logique de routage

```text
trackEvent(name, params, prestataireId?)
  ├── GA4 activé ? → gtag("event", name, params)
  └── prestataireId fourni ? → insert evenements_prestataire
```

Les événements liés à un prestataire (vue_profil, affichage_telephone, premier_contact) vont dans les deux systèmes. Les événements globaux (recherche, inscription, connexion, envoi_message) vont uniquement dans GA4.

### Aucune migration nécessaire
La table `evenements_prestataire` existe déjà avec les bonnes RLS policies (insert public).

