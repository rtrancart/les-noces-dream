import { forwardRef, useEffect, useState } from "react";
import { History } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fetchHistorique, type HistoriqueEntry } from "@/hooks/useHistoriqueNavigation";
import HistoriqueList from "@/components/HistoriqueList";

export default function HeaderHistoriqueButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<HistoriqueEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchHistorique(user?.id ?? null, 5).then((res) => {
      setEntries(res);
      setLoading(false);
    });
  }, [open, user?.id]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <HistoriqueTriggerButton />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="font-sans text-xs font-medium text-foreground uppercase tracking-wide">
            Récemment consultés
          </p>
          {user && (
            <Link
              to="/mon-compte/historique"
              onClick={() => setOpen(false)}
              className="font-sans text-xs text-primary hover:underline"
            >
              Voir tout
            </Link>
          )}
        </div>
        {loading ? (
          <p className="font-sans text-xs text-muted-foreground py-6 text-center">Chargement…</p>
        ) : (
          <HistoriqueList entries={entries} onItemClick={() => setOpen(false)} />
        )}
      </PopoverContent>
    </Popover>
  );
}

const HistoriqueTriggerButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  (props, ref) => (
    <button
      ref={ref}
      {...props}
      className="text-white/90 hover:text-white transition-colors"
      aria-label="Historique de navigation"
    >
      <History className="w-5 h-5" />
    </button>
  )
);
HistoriqueTriggerButton.displayName = "HistoriqueTriggerButton";
