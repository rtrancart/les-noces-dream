/**
 * Filtre PostgREST des définitions de champs applicables à une fiche :
 * champs communs (categorie_id NULL) + catégorie mère + catégorie fille.
 */
export function champsCategoriesFilter(
  categorieMereId?: string | null,
  categorieFilleId?: string | null,
): string {
  const ids = [categorieMereId, categorieFilleId].filter(Boolean) as string[];
  const clauses = ["categorie_id.is.null"];
  if (ids.length > 0) clauses.push(`categorie_id.in.(${ids.join(",")})`);
  return clauses.join(",");
}
