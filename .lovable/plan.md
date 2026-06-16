## Pourquoi le rendu actuel est cassé

Sur `MariageRegion.tsx` (lignes 810-822), le champ `contenu_seo_bas` est injecté tel quel via `dangerouslySetInnerHTML` dans un conteneur `prose`. Le rendu attend donc du **HTML brut** (`<h2>`, `<p>`, `<ul><li>`, `<strong>`…). Or les 13 textes en base sont aujourd'hui stockés en **texte brut** (paragraphes séparés par des sauts de ligne, sans balises). Résultat : tout s'affiche en un seul bloc sans hiérarchie, sans gras, sans liste.

Le projet contient déjà un mini-parser Markdown (`src/lib/markdown.ts`) utilisé ailleurs — on s'appuie dessus.

## Ce que je vais faire

### 1. Renderer Markdown sur la page publique
Dans `src/pages/MariageRegion.tsx`, remplacer le bloc `dangerouslySetInnerHTML` (l. 816-822) par un rendu basé sur `parseMarkdown()` qui produit du vrai JSX (`<h2>`, `<h3>`, `<p>`, `<ul><li>`, `<strong>`, `<em>`, `<blockquote>`), stylé avec les classes Tailwind déjà en place (`prose` + tokens `text-bleu-abysse`, `text-or-riche`, `font-serif`). Aucune balise HTML brute n'est attendue côté admin — on tape en Markdown.

### 2. Mettre à jour l'admin
Dans `src/pages/admin/Regions.tsx` (l. 486-488) :
- Changer le placeholder du `<Textarea>` : « Markdown : `## Titre`, `### Sous-titre`, `**gras**`, `- liste`, ligne vide entre paragraphes ».
- Ajouter sous le compteur de mots un mini-mémo des balises supportées.

### 3. Reformater les 13 textes existants
Lire les 13 `contenu_seo_bas` actuels (déjà identifiés), produire pour chacun une version Markdown structurée :
- un `## H2` d'ouverture par grand chapitre (≈ 3-5 par région) déduit du contenu existant,
- `### H3` pour les sous-sections (lieux, gastronomie, budget, logistique, saison…),
- `**gras**` sur les chiffres-clés et noms propres importants,
- `- liste` pour les énumérations existantes (qui sont aujourd'hui en phrases),
- paragraphes séparés par une ligne vide.

Aucun mot n'est ajouté ni retiré : on respecte la cible 800-1200 mots déjà en place et le ton éditorial. Mise à jour via `UPDATE pages_regions_mariage SET contenu_seo_bas = ... WHERE slug_region = ...` (13 lignes, opération data).

## Format Markdown supporté côté admin

```text
## Titre de section
### Sous-titre
Paragraphe normal avec **gras** et *italique*.

- Premier item
- Deuxième item

> Citation ou mise en avant
```

## Périmètre

- 1 fichier modifié : `src/pages/MariageRegion.tsx` (rendu).
- 1 fichier modifié : `src/pages/admin/Regions.tsx` (placeholder + aide).
- 13 `UPDATE` data sur `pages_regions_mariage` (un par région publiée).
- Aucun changement de schéma, aucune migration, aucune RLS.
