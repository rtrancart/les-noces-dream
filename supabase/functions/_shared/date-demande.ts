// ATTENTION : doit rester STRICTEMENT IDENTIQUE (sous ce commentaire) à src/lib/dateDemande.ts
const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function formaterDateEvenement(
  dateIso?: string | null,
  precision?: "jour" | "mois" | string | null,
): string {
  if (!dateIso) return "Non précisée";
  const match = dateIso.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!match) return "Non précisée";
  const annee = parseInt(match[1], 10);
  const moisIndex = parseInt(match[2], 10) - 1;
  const jour = match[3] ? parseInt(match[3], 10) : null;
  if (moisIndex < 0 || moisIndex > 11) return "Non précisée";
  const nomMois = MOIS_FR[moisIndex];
  if (precision === "mois" || !jour) {
    return `${nomMois.charAt(0).toUpperCase() + nomMois.slice(1)} ${annee} (jour non fixé)`;
  }
  return `${jour === 1 ? "1er" : String(jour)} ${nomMois} ${annee}`;
}
