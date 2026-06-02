## Objectif
Remplacer le picto `MapPin` et le label "Prestataires" des cartes régions sur la home par la hero image de chaque région (`pages_regions_mariage.image_hero_url`).

## Étapes

1. **Charger les images hero**
   - Dans `src/pages/Index.tsx`, ajouter une requête Supabase (via `useQuery`) : `SELECT slug_region, image_hero_url FROM pages_regions_mariage WHERE est_publiee = true`.
   - Construire une map `{ slug → image_hero_url }`.

2. **Mettre à jour `RegionCard`**
   - Accepter une prop `imageUrl?: string`.
   - Si présente : utiliser comme `background-image` (avec `?width=400&quality=75` via transformations Supabase Storage) + overlay sombre pour lisibilité du nom de région.
   - Si absente : conserver un fallback neutre (dégradé subtil, sans le `MapPin`).
   - Supprimer l'icône `MapPin` et le texte "Prestataires".

3. **Garder le reste intact**
   - Nom de la région, lien vers `/mariage/[slug]`, hover, layout grid : inchangés.

## Détails techniques
- Requête légère (~13 lignes), cachée par React Query → impact perf négligeable.
- Images servies via CDN Supabase Storage, redimensionnées à 400px de large.
- Fallback gracieux si une région n'a pas encore d'`image_hero_url`.
