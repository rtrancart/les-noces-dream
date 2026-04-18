import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const SESSION_KEY = "lesnoces_historique_anonyme";
const MAX_ENTRIES = 20;

export interface HistoriqueEntry {
  prestataire_id: string;
  consulte_le: string;
  nb_consultations: number;
  prestataire?: {
    id: string;
    nom_commercial: string;
    slug: string;
    ville: string;
    photo_principale_url: string | null;
    categorie_nom?: string;
  };
}

/** Lit l'historique sessionStorage (visiteurs anonymes) */
export function readSessionHistorique(): HistoriqueEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as HistoriqueEntry[]) : [];
  } catch {
    return [];
  }
}

function writeSessionHistorique(entries: HistoriqueEntry[]) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* quota/disabled */
  }
}

function trackAnonymous(prestataire_id: string) {
  const list = readSessionHistorique();
  const idx = list.findIndex((e) => e.prestataire_id === prestataire_id);
  if (idx >= 0) {
    const existing = list[idx];
    list.splice(idx, 1);
    list.unshift({
      ...existing,
      consulte_le: new Date().toISOString(),
      nb_consultations: existing.nb_consultations + 1,
    });
  } else {
    list.unshift({
      prestataire_id,
      consulte_le: new Date().toISOString(),
      nb_consultations: 1,
    });
  }
  writeSessionHistorique(list);
}

/** Hook : enregistre la consultation d'une fiche prestataire */
export function useTrackVisitePrestataire(prestataireId: string | null | undefined) {
  const { user } = useAuth();

  useEffect(() => {
    if (!prestataireId) return;

    if (user?.id) {
      supabase
        .rpc("enregistrer_consultation_prestataire", { p_prestataire_id: prestataireId })
        .then(({ error }) => {
          if (error) console.error("Tracking historique error:", error);
        });
    } else {
      trackAnonymous(prestataireId);
    }
  }, [prestataireId, user?.id]);
}

/** Récupère l'historique enrichi (DB pour user connecté, sessionStorage sinon) */
export async function fetchHistorique(userId: string | null, limit = 20): Promise<HistoriqueEntry[]> {
  if (userId) {
    const { data, error } = await supabase
      .from("historique_navigation")
      .select(
        "prestataire_id, consulte_le, nb_consultations, prestataire:prestataires(id, nom_commercial, slug, ville, photo_principale_url, categorie_mere:categories!prestataires_categorie_mere_id_fkey(nom))"
      )
      .eq("user_id", userId)
      .order("consulte_le", { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((d: any) => ({
      prestataire_id: d.prestataire_id,
      consulte_le: d.consulte_le,
      nb_consultations: d.nb_consultations,
      prestataire: d.prestataire
        ? {
            id: d.prestataire.id,
            nom_commercial: d.prestataire.nom_commercial,
            slug: d.prestataire.slug,
            ville: d.prestataire.ville,
            photo_principale_url: d.prestataire.photo_principale_url,
            categorie_nom: d.prestataire.categorie_mere?.nom,
          }
        : undefined,
    }));
  }

  // Anonyme : enrichir depuis sessionStorage
  const session = readSessionHistorique().slice(0, limit);
  if (session.length === 0) return [];

  const ids = session.map((e) => e.prestataire_id);
  const { data } = await supabase
    .from("prestataires")
    .select("id, nom_commercial, slug, ville, photo_principale_url, categorie_mere:categories!prestataires_categorie_mere_id_fkey(nom)")
    .in("id", ids);

  const byId = new Map((data ?? []).map((p: any) => [p.id, p]));
  return session
    .map((e) => {
      const p: any = byId.get(e.prestataire_id);
      if (!p) return null;
      return {
        ...e,
        prestataire: {
          id: p.id,
          nom_commercial: p.nom_commercial,
          slug: p.slug,
          ville: p.ville,
          photo_principale_url: p.photo_principale_url,
          categorie_nom: p.categorie_mere?.nom,
        },
      };
    })
    .filter(Boolean) as HistoriqueEntry[];
}
