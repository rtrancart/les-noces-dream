import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { dateReference, lireTaches, majTache, type Tache } from "@/lib/planning";

export function useTaches() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const cle = ["atelier-taches", user?.id];
  const requete = useQuery({
    queryKey: cle, enabled: !!user,
    queryFn: async () => {
      const [{ taches, liens }, pm] = await Promise.all([
        lireTaches(user!.id),
        supabase.from("profils_mariage").select("date_mariage, date_mois, date_annee").eq("user_id", user!.id).maybeSingle(),
      ]);
      return { taches, liens, ref: dateReference(pm.data) };
    },
  });
  const modifier = async (t: Tache, patch: Parameters<typeof majTache>[1]) => {
    qc.setQueryData(cle, (d: typeof requete.data) => d && { ...d, taches: d.taches.map((x) => (x.id === t.id ? { ...x, ...patch, faite_le: patch.faite ? new Date().toISOString() : patch.faite === false ? null : x.faite_le } : x)) });
    try { await majTache(t.id, patch); } catch { toast.error("La modification n'a pas pu être enregistrée."); }
    qc.invalidateQueries({ queryKey: cle });
  };
  return { ...requete, modifier, recharger: () => qc.invalidateQueries({ queryKey: cle }), userId: user?.id };
}
