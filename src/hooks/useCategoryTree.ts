import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CategoryOption } from "@/components/CategoryPicker";

export function useCategoryTree() {
  return useQuery<CategoryOption[]>({
    queryKey: ["category-tree"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, nom, slug, icone_url, parent_id")
        .eq("est_active", true)
        .order("ordre_affichage");
      if (error) throw error;
      const rows = data ?? [];
      const parents = rows.filter((c) => !c.parent_id);
      const children = rows.filter((c) => c.parent_id);
      return parents.map((p) => ({
        id: p.id,
        nom: p.nom,
        slug: p.slug,
        icone_url: p.icone_url,
        children: children
          .filter((c) => c.parent_id === p.id)
          .map((c) => ({ id: c.id, nom: c.nom, slug: c.slug, icone_url: c.icone_url })),
      }));
    },
  });
}
