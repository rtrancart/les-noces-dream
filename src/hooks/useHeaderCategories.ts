import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HeaderSubCategory {
  id: string;
  nom: string;
  slug: string;
  parent_slug: string;
}

export interface HeaderMereCategory {
  id: string;
  nom: string;
  slug: string;
  icone_url: string | null;
  enfants: HeaderSubCategory[];
}

export interface HeaderFamille {
  id: string | null;          // null pour le groupe "Autres"
  cle: string;
  libelle: string;
  ordre_affichage: number;
  meres: HeaderMereCategory[];
}

const AUTRES_KEY = "__autres__";

export function useHeaderCategories() {
  return useQuery({
    queryKey: ["header-categories"],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<HeaderFamille[]> => {
      const [famillesRes, catsRes] = await Promise.all([
        supabase
          .from("categories_familles")
          .select("id, cle, libelle, ordre_affichage")
          .order("ordre_affichage", { ascending: true }),
        supabase
          .from("categories")
          .select("id, nom, slug, parent_id, icone_url, famille_id, ordre_affichage, est_active")
          .eq("est_active", true)
          .order("ordre_affichage", { ascending: true }),
      ]);

      if (famillesRes.error) throw famillesRes.error;
      if (catsRes.error) throw catsRes.error;

      const cats = catsRes.data ?? [];
      const meres = cats.filter((c) => !c.parent_id);
      const enfantsParMere = new Map<string, HeaderSubCategory[]>();
      cats
        .filter((c) => c.parent_id)
        .forEach((c) => {
          const parent = meres.find((m) => m.id === c.parent_id);
          if (!parent) return;
          const arr = enfantsParMere.get(c.parent_id!) ?? [];
          arr.push({ id: c.id, nom: c.nom, slug: c.slug, parent_slug: parent.slug });
          enfantsParMere.set(c.parent_id!, arr);
        });

      const familles: HeaderFamille[] = (famillesRes.data ?? []).map((f) => ({
        id: f.id,
        cle: f.cle,
        libelle: f.libelle,
        ordre_affichage: f.ordre_affichage,
        meres: meres
          .filter((m) => m.famille_id === f.id)
          .map((m) => ({
            id: m.id,
            nom: m.nom,
            slug: m.slug,
            icone_url: m.icone_url ?? null,
            enfants: enfantsParMere.get(m.id) ?? [],
          })),
      }));

      const orphelines = meres.filter((m) => !m.famille_id);
      if (orphelines.length > 0) {
        familles.push({
          id: null,
          cle: AUTRES_KEY,
          libelle: "Autres",
          ordre_affichage: 9999,
          meres: orphelines.map((m) => ({
            id: m.id,
            nom: m.nom,
            slug: m.slug,
            icone_url: m.icone_url ?? null,
            enfants: enfantsParMere.get(m.id) ?? [],
          })),
        });
      }

      return familles.filter((f) => f.meres.length > 0);
    },
  });
}

export function useHeaderRegions() {
  return useQuery({
    queryKey: ["header-regions"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pages_regions_mariage")
        .select("slug_region, nom_region")
        .eq("est_publiee", true)
        .order("nom_region", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}
