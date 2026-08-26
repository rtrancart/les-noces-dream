// Recensement unique des pages indexables du site public.
//
// SOURCE DE VÉRITÉ PARTAGÉE : consommé à la fois par `generate-sitemap`
// (génération du sitemap.xml) et par `prerender-reconcile` (alimentation de la
// file de pré-rendu). Aucune duplication de filtre entre les deux.
//
// La logique de recensement ET le calcul de l'empreinte de contenu visible
// vivent en base, dans la fonction SQL `prerender_pages_indexables()`, afin de
// ne jamais charger l'ensemble des pages en mémoire côté Deno.
//
// PÉRIMÈTRE INDEXABLE
//   inclus  : `/` (accueil), `/blog` (index), `/mariage/{region}`,
//             `/prestataires/{categorie}`, `/prestataires/{mere}/{fille}`,
//             `/blog/{slug}`, `/{slug}` (pages éditoriales et légales),
//             `/prestataire/{slug}`
//   exclus  : `/connexion`, `/inscription` (pages de compte, non indexables),
//             `/recherche` (canonicalisée vers les pages catégorie),
//             toute page d'espace privé, admin, ou de tunnel.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type PageType =
  | "statique"
  | "region"
  | "categorie"
  | "categorie_fille"
  | "article_blog"
  | "page_contenu"
  | "prestataire";

export type PageIndexable = {
  /** Chemin absolu sans domaine, commence toujours par « / ». */
  url_path: string;
  page_type: PageType;
  source_id: string | null;
  /** Empreinte md5 du contenu visible par un visiteur (jamais d'horodatage). */
  signature: string;
  /** Dernière modification connue de la source — utilisée par le sitemap seul. */
  lastmod: string | null;
};

/** Priorité et fréquence sitemap par type de page. */
export const SITEMAP_HINTS: Record<PageType, { priority: string; changefreq: string }> = {
  statique: { priority: "1.0", changefreq: "daily" },
  region: { priority: "0.8", changefreq: "monthly" },
  categorie: { priority: "0.7", changefreq: "weekly" },
  categorie_fille: { priority: "0.6", changefreq: "weekly" },
  article_blog: { priority: "0.6", changefreq: "monthly" },
  page_contenu: { priority: "0.4", changefreq: "monthly" },
  prestataire: { priority: "0.7", changefreq: "weekly" },
};

/**
 * Recense toutes les pages indexables (ensemble complet, non paginé).
 * Réservé au sitemap : la réconciliation, elle, travaille par tranches en base.
 */
export async function listerPagesIndexables(
  supabase: SupabaseClient,
): Promise<PageIndexable[]> {
  const { data, error } = await supabase.rpc("prerender_pages_indexables");
  if (error) throw new Error(`Recensement des pages indexables impossible : ${error.message}`);
  return (data ?? []) as PageIndexable[];
}

/** Ordre d'affichage stable : même tri que la pagination de la réconciliation. */
export function trierPages(pages: PageIndexable[]): PageIndexable[] {
  return [...pages].sort((a, b) => a.url_path.localeCompare(b.url_path));
}
