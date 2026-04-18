import { forwardRef, useEffect, useState } from "react";
import { History } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fetchHistorique, readSessionHistorique, type HistoriqueEntry } from "@/hooks/useHistoriqueNavigation";
import HistoriqueList from "@/components/HistoriqueList";

export default function HeaderHistoriqueButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<HistoriqueEntry[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadCount = async () => {
    if (user?.id) {
      const entries = await fetchHistorique(user.id, 20);
      setCount(entries.length);
    } else {
      setCount(readSessionHistorique().length);
    }
  };

  useEffect(() => {
    loadCount();
  }, [user?.id]);

  useEffect(() => {
    if (!open) {
      loadCount();
      return;
    }
    setLoading(true);
    fetchHistorique(user?.id ?? null, 5).then((res) => {
      setEntries(res);
      setCount(res.length);
      setLoading(false);
    });
  }, [open, user?.id]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <HistoriqueTriggerButton count={count} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="font-sans text-xs font-medium text-foreground uppercase tracking-wide">
            Récemment consultés
          </p>
          <Link
            to={user ? "/mon-compte/historique" : "/prestataires-consultes"}
            onClick={() => setOpen(false)}
            className="font-sans text-xs text-primary hover:underline"
          >
            Voir tout
          </Link>
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

interface HistoriqueTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  count: number;
}

const HistoriqueTriggerButton = forwardRef<HTMLButtonElement, HistoriqueTriggerProps>(
  ({ count, ...props }, ref) => (
    <button
      ref={ref}
      {...props}
      className="relative text-white/90 hover:text-white transition-colors"
      aria-label="Historique de navigation"
    >
      <History className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute -bottom-1 -left-1 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center bg-primary text-white text-[9px] font-sans font-semibold rounded-full">
          {count >= 10 ? "9+" : count}
        </span>
      )}
    </button>
  )
);
HistoriqueTriggerButton.displayName = "HistoriqueTriggerButton";
