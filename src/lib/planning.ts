import { supabase } from "@/integrations/supabase/client";

export type Tache = {
  id: string; user_id: string; modele_id: string | null; titre: string; description: string | null; categorie: string;
  date_echeance: string; echeance_origine: string | null; priorite: number; faite: boolean; faite_le: string | null;
  masquee: boolean; perso: boolean;
};
export type ModeleLien = { id: string; categorie_prestataire: string | null; message_assistant: string | null; lien_module: string | null };

export const CATEGORIES_TACHE = ["Organisation", "Invités", "Prestataires", "Cérémonie", "Style", "Tenues", "Papeterie", "Administratif", "Après le mariage"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Date du jour au format AAAA-MM-JJ (heure locale). */
export function aujourdhui(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Date de référence : date exacte, sinon le 15 du mois. Même règle que la base. */
export function dateReference(p: { date_mariage?: string | null; date_mois?: number | null; date_annee?: number | null } | null | undefined): string | null {
  if (!p) return null;
  if (p.date_mariage) return p.date_mariage;
  if (p.date_mois && p.date_annee) return `${p.date_annee}-${String(p.date_mois).padStart(2, "0")}-15`;
  return null;
}

/** Copie de echeance_retroplanning (SQL) : mois entiers puis reste × 30 jours, tronqué. */
export function echeance(ref: string, moisAvant: number): string {
  const [a, m, j] = ref.split("-").map(Number);
  const entiers = Math.trunc(moisAvant);
  const jours = Math.trunc((moisAvant - entiers) * 30 + 1e-9 * Math.sign(moisAvant));
  // Comme Postgres : on retire les mois en bornant au dernier jour du mois, puis les jours.
  const cible = new Date(Date.UTC(a, m - 1 - entiers, 1));
  const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  cible.setUTCDate(Math.min(j, dernier));
  cible.setUTCDate(cible.getUTCDate() - jours);
  return cible.toISOString().slice(0, 10);
}

const parRattrapage = (a: Tache, b: Tache) =>
  a.priorite - b.priorite || (a.echeance_origine ?? a.date_echeance).localeCompare(b.echeance_origine ?? b.date_echeance) || a.titre.localeCompare(b.titre);
const parEcheance = (a: Tache, b: Tache) => a.date_echeance.localeCompare(b.date_echeance) || a.priorite - b.priorite;

export type GroupeMois = { cle: string; libelle: string; taches: Tache[]; courant: boolean; passe: boolean; mariage: boolean };
export type Sections = {
  rattraper: Tache[]; rattraperFacultatives: Tache[]; mois: GroupeMois[]; apres: Tache[];
  masquees: Tache[]; faites: number; actives: number; mariagePasse: boolean;
};

export function libelleMois(cle: string): string {
  const [a, m] = cle.split("-").map(Number);
  return `${MOIS[m - 1].charAt(0).toUpperCase()}${MOIS[m - 1].slice(1)} ${a}`;
}
export function dateCourte(iso: string, jour = aujourdhui()): string {
  const [a, m, j] = iso.split("-").map(Number);
  return `${j === 1 ? "1er" : j} ${MOIS[m - 1]}${String(a) !== jour.slice(0, 4) ? ` ${a}` : ""}`;
}

export function construireSections(taches: Tache[], ref: string, jour = aujourdhui()): Sections {
  const visibles = taches.filter((t) => !t.masquee);
  const masquees = taches.filter((t) => t.masquee);
  const avant = visibles.filter((t) => t.date_echeance <= ref);
  const apres = visibles.filter((t) => t.date_echeance > ref).sort(parEcheance);
  const enRetard = avant.filter((t) => !t.faite && t.date_echeance < jour).sort(parRattrapage);
  const idsRetard = new Set(enRetard.map((t) => t.id));
  const moisCourant = jour.slice(0, 7);
  const cleMariage = ref.slice(0, 7);
  const groupes = new Map<string, Tache[]>();
  for (const t of avant.filter((t) => !idsRetard.has(t.id)).sort(parEcheance)) {
    const c = t.date_echeance.slice(0, 7);
    groupes.set(c, [...(groupes.get(c) ?? []), t]);
  }
  if (!groupes.has(cleMariage)) groupes.set(cleMariage, []);
  const mois = [...groupes.keys()].sort().map((cle) => ({
    cle, libelle: libelleMois(cle), taches: groupes.get(cle)!, courant: cle === moisCourant, passe: cle < moisCourant, mariage: cle === cleMariage,
  }));
  return {
    rattraper: enRetard.filter((t) => t.priorite < 3), rattraperFacultatives: enRetard.filter((t) => t.priorite >= 3),
    mois, apres, masquees, faites: visibles.filter((t) => t.faite).length, actives: visibles.length, mariagePasse: ref < jour,
  };
}

/** Bloc « À faire ce mois-ci » : d'abord À rattraper, puis les tâches du mois (3 max). */
export function aFaireCeMois(taches: Tache[], ref: string, jour = aujourdhui(), max = 3): Tache[] {
  const s = construireSections(taches, ref, jour);
  if (s.mariagePasse) return s.apres.filter((t) => !t.faite).slice(0, max);
  const duMois = s.mois.find((g) => g.courant)?.taches.filter((t) => !t.faite) ?? [];
  return [...s.rattraper, ...duMois, ...s.rattraperFacultatives].slice(0, max);
}

export async function lireTaches(userId: string) {
  const [t, m] = await Promise.all([
    supabase.from("taches_couple").select("*").eq("user_id", userId).order("date_echeance"),
    supabase.from("modeles_retroplanning").select("id, categorie_prestataire, message_assistant, lien_module"),
  ]);
  if (t.error) throw t.error;
  const liens = new Map<string, ModeleLien>(((m.data ?? []) as ModeleLien[]).map((x) => [x.id, x]));
  return { taches: (t.data ?? []) as unknown as Tache[], liens };
}

export async function majTache(id: string, patch: Partial<Pick<Tache, "faite" | "masquee" | "date_echeance" | "titre" | "categorie">>) {
  const { data, error } = await supabase.from("taches_couple").update(patch).eq("id", id).select("id");
  if (error || !data?.length) throw error ?? new Error("Modification refusée");
}
