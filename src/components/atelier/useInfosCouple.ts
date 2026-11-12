import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Prénom et date du mariage (enregistrée dans le budget de l'espace mariés, si renseignée). */
export function useInfosCouple() {
  const { user, profile } = useAuth();
  const { data: date } = useQuery({
    queryKey: ["atelier-date", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("planificateur").select("date_evenement").eq("user_id", user!.id)
        .not("date_evenement", "is", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      return (data?.date_evenement as string | null) ?? null;
    },
  });
  const dateMariage = date ? new Date(`${date}T12:00:00`) : null;
  const jours = dateMariage ? Math.ceil((dateMariage.getTime() - Date.now()) / 86_400_000) : null;
  return {
    nom: profile?.prenom?.trim() || "Vos noces",
    dateMariage,
    dateTexte: dateMariage ? dateMariage.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null,
    jours: jours !== null && jours >= 0 ? jours : null,
  };
}
