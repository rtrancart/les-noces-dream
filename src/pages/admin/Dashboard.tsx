import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, FileText, Star, Users } from "lucide-react";

interface Stats {
  prestataires: number;
  demandes: number;
  avis: number;
  utilisateurs: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ prestataires: 0, demandes: 0, avis: 0, utilisateurs: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [p, d, a, u] = await Promise.all([
        supabase.from("prestataires").select("id", { count: "exact", head: true }),
        supabase.from("demandes_devis").select("id", { count: "exact", head: true }),
        supabase.from("avis").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        prestataires: p.count ?? 0,
        demandes: d.count ?? 0,
        avis: a.count ?? 0,
        utilisateurs: u.count ?? 0,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  const cards = [
    { label: "Prestataires", value: stats.prestataires, icon: Store, color: "text-primary" },
    { label: "Demandes de devis", value: stats.demandes, icon: FileText, color: "text-accent" },
    { label: "Avis", value: stats.avis, icon: Star, color: "text-or-riche" },
    { label: "Utilisateurs", value: stats.utilisateurs, icon: Users, color: "text-bleu-petrole" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-serif font-semibold text-foreground">Tableau de bord</h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">Vue d'ensemble de votre plateforme</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="font-sans text-sm font-medium text-muted-foreground">
                {c.label}
              </CardTitle>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 w-16 animate-pulse rounded bg-muted/30" />
              ) : (
                <p className="text-3xl font-serif font-bold text-foreground">{c.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
