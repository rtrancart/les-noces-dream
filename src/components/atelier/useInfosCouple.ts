import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Prénom, date et lieu du mariage : profil « Notre style » d'abord, sinon la date saisie dans le budget. */
export function useInfosCouple() {
  const { user, profile } = useAuth();
  const { data } = useQuery({
    queryKey: ["atelier-infos", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: pm } = await supabase.from("profils_mariage").select("date_mariage, date_mois, date_annee, lieu_libelle").eq("user_id", user!.id).maybeSingle();
      if (pm?.date_mariage || pm?.date_mois) return pm;
      const { data: pl } = await supabase.from("planificateur").select("date_evenement").eq("user_id", user!.id)
        .not("date_evenement", "is", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      return { date_mariage: (pl?.date_evenement as string | null) ?? null, date_mois: null, date_annee: null, lieu_libelle: pm?.lieu_libelle ?? null };
    },
  });
  const dateMariage = data?.date_mariage ? new Date(`${data.date_mariage}T12:00:00`) : null;
  const jours = dateMariage ? Math.ceil((dateMariage.getTime() - Date.now()) / 86_400_000) : null;
  const dateTexte = dateMariage
    ? dateMariage.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : data?.date_mois && data?.date_annee ? `${MOIS[data.date_mois - 1]} ${data.date_annee}` : null;
  return {
    nom: profile?.prenom?.trim() || "Vos noces",
    dateMariage,
    dateTexte: dateTexte && data?.lieu_libelle ? `${dateTexte} · ${data.lieu_libelle}` : dateTexte,
    jours: jours !== null && jours >= 0 ? jours : null,
  };
}
