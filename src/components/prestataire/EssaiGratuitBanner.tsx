import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSharedPrestataire } from "@/contexts/PrestataireContext";

/**
 * Badge « Essai gratuit » — visible dans l'espace pro tant que la date de fin
 * d'essai est dans le futur et qu'aucun abonnement payant n'est actif.
 * Ton d'alerte dans les 15 derniers jours. Jamais affiché sur la fiche publique.
 */
export function EssaiGratuitBanner() {
  const { prestataire } = useSharedPrestataire();
  const [finEssai, setFinEssai] = useState<string | null>(null);

  useEffect(() => {
    if (!prestataire?.id) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("abonnements")
        .select("plan, statut, fin_essai_le")
        .eq("prestataire_id", prestataire.id)
        .maybeSingle();

      if (cancelled || !data?.fin_essai_le) return;
      // Abonnement payant déjà en cours : pas de badge d'essai.
      if (data.statut === "actif" || data.statut === "en_retard") return;
      if (new Date(data.fin_essai_le).getTime() <= Date.now()) return;

      setFinEssai(data.fin_essai_le);
    })();

    return () => {
      cancelled = true;
    };
  }, [prestataire?.id]);

  if (!finEssai) return null;

  const joursRestants = Math.ceil(
    (new Date(finEssai).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  const urgent = joursRestants <= 15;

  const dateLabel = new Date(finEssai).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="rounded-md border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      style={
        urgent
          ? { background: "#FBEDE4", borderColor: "#E8C4A8" }
          : { background: "#F4E8D0", borderColor: "#E0CDA0" }
      }
    >
      <div className="flex items-start gap-3">
        <Sparkles
          className="h-5 w-5 shrink-0 mt-0.5"
          style={{ color: urgent ? "#B5601F" : "#A57D27" }}
        />
        <div className="space-y-0.5">
          <p className="font-sans font-medium text-sm text-foreground">
            Essai gratuit — jusqu'au {dateLabel}
          </p>
          <p className="font-sans text-xs text-foreground/70">
            {urgent
              ? `Plus que ${joursRestants} jour${joursRestants > 1 ? "s" : ""} : souscrivez dès maintenant pour éviter toute interruption.`
              : "Vous profitez de toutes les fonctionnalités. Vous pouvez souscrire à tout moment."}
          </p>
        </div>
      </div>
      <Link
        to="/espace-pro/abonnement"
        className="inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 transition shrink-0 hover:opacity-90"
        style={{ background: urgent ? "#B5601F" : "#A57D27", color: "white" }}
      >
        Voir les offres
      </Link>
    </div>
  );
}
