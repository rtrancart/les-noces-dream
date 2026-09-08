import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { formatDateFr, usePromoLancement } from "@/hooks/usePromoLancement";

/**
 * Bandeau incitatif de l'offre de lancement (P7).
 * L'éligibilité est recalculée côté serveur à chaque affichage.
 */
export default function PromoLancementBanner({ prestataireId }: { prestataireId?: string | null }) {
  const { promo } = usePromoLancement(prestataireId);
  if (!promo?.eligible) return null;

  const jours = promo.jours_restants ?? 0;

  return (
    <div className="rounded-lg border-l-4 border-primary bg-primary/10 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 shrink-0 text-primary" size={20} />
          <div>
            <h3 className="font-serif text-lg text-foreground">
              Offre de lancement — jusqu'à -45 % pendant 1 an
            </h3>
            <p className="font-sans text-sm text-muted-foreground">
              {jours > 0
                ? `Il vous reste ${jours} jour${jours > 1 ? "s" : ""} pour en profiter, jusqu'au ${formatDateFr(promo.date_limite)}.`
                : `Dernier jour pour en profiter, jusqu'au ${formatDateFr(promo.date_limite)}.`}
            </p>
          </div>
        </div>
        <Link
          to="/espace-pro/abonnement"
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-center font-sans text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Voir les formules
        </Link>
      </div>
    </div>
  );
}
