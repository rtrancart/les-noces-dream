import { Link } from "react-router-dom";
import { Clock, ImageIcon } from "lucide-react";
import type { HistoriqueEntry } from "@/hooks/useHistoriqueNavigation";

interface Props {
  entries: HistoriqueEntry[];
  emptyLabel?: string;
  onItemClick?: () => void;
  variant?: "compact" | "full";
}

function formatRelative(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return new Date(date).toLocaleDateString("fr-FR");
}

export default function HistoriqueList({ entries, emptyLabel = "Aucune fiche consultée pour le moment", onItemClick, variant = "compact" }: Props) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <Clock className="h-6 w-6 text-muted-foreground" />
        <p className="font-sans text-xs text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-0">
      {entries.map((e) => {
        if (!e.prestataire) return null;
        const p = e.prestataire;
        return (
          <li key={e.prestataire_id}>
            <Link
              to={`/prestataire/${p.slug}`}
              onClick={onItemClick}
              className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 hover:bg-secondary/50 -mx-2 px-2 rounded-sm transition-colors"
            >
              <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                {p.photo_principale_url ? (
                  <img src={p.photo_principale_url} alt={p.nom_commercial} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-sans text-sm font-medium text-foreground truncate">{p.nom_commercial}</p>
                <p className="font-sans text-xs text-muted-foreground truncate">
                  {p.categorie_nom ? `${p.categorie_nom} · ` : ""}{p.ville}
                </p>
                {variant === "full" && (
                  <p className="font-sans text-xs text-muted-foreground/80 mt-0.5">
                    {formatRelative(e.consulte_le)} · {e.nb_consultations} consultation{e.nb_consultations > 1 ? "s" : ""}
                  </p>
                )}
              </div>
              {variant === "compact" && (
                <span className="font-sans text-xs text-muted-foreground shrink-0">{formatRelative(e.consulte_le)}</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
