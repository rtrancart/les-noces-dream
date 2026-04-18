import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { fetchHistorique, type HistoriqueEntry } from "@/hooks/useHistoriqueNavigation";
import HistoriqueList from "@/components/HistoriqueList";

export default function HistoriqueWidget() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<HistoriqueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistorique(user?.id ?? null, 3).then((res) => {
      setEntries(res);
      setLoading(false);
    });
  }, [user?.id]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-sans text-sm">Récemment consultés</CardTitle>
          <Link to="/mon-compte/historique" className="font-sans text-xs text-primary hover:underline">
            Voir tout →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="font-sans text-xs text-muted-foreground text-center py-4">Chargement…</p>
        ) : (
          <HistoriqueList entries={entries} emptyLabel="Aucune fiche consultée récemment" />
        )}
      </CardContent>
    </Card>
  );
}
