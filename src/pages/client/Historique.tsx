import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchHistorique, type HistoriqueEntry } from "@/hooks/useHistoriqueNavigation";
import HistoriqueList from "@/components/HistoriqueList";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function HistoriqueClient() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<HistoriqueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await fetchHistorique(user?.id ?? null, 20);
    setEntries(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const clearAll = async () => {
    if (!user?.id) return;
    const { error } = await supabase.from("historique_navigation").delete().eq("user_id", user.id);
    if (error) {
      toast.error("Impossible de vider l'historique");
      return;
    }
    setEntries([]);
    toast.success("Historique vidé");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-foreground">Historique de navigation</h1>
          <p className="font-sans text-sm text-muted-foreground mt-1">
            Les 20 dernières fiches prestataires consultées (conservées 90 jours).
          </p>
        </div>
        {entries.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearAll} className="shrink-0">
            <Trash2 className="h-4 w-4 mr-2" />
            Vider
          </Button>
        )}
      </div>

      <div className="bg-card rounded-lg shadow-sm p-4">
        {loading ? (
          <p className="font-sans text-sm text-muted-foreground text-center py-8">Chargement…</p>
        ) : (
          <HistoriqueList entries={entries} variant="full" emptyLabel="Vous n'avez encore consulté aucune fiche prestataire" />
        )}
      </div>
    </div>
  );
}
