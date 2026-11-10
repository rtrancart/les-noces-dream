export interface IaTarif {
  model: string;
  prix_entree_eur_par_million: number | null;
  prix_sortie_eur_par_million: number | null;
}

/** Coût en € calculé à l'affichage avec les tarifs actuels ; null si tarif manquant. */
export function calculerCoutIa(
  tokensEntree: number | null,
  tokensSortie: number | null,
  tarif: IaTarif | undefined,
): number | null {
  if (!tarif || tarif.prix_entree_eur_par_million == null || tarif.prix_sortie_eur_par_million == null) return null;
  if (tokensEntree == null || tokensSortie == null) return null;
  return (tokensEntree * Number(tarif.prix_entree_eur_par_million) + tokensSortie * Number(tarif.prix_sortie_eur_par_million)) / 1_000_000;
}

export function formaterCoutIa(c: number | null): string {
  return c == null ? "tarif manquant" : `${c.toLocaleString("fr-FR", { maximumFractionDigits: 6 })} €`;
}
