import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePrestataire } from "@/hooks/usePrestataire";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Star, TrendingUp, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface DashboardStats {
  totalDemandes: number;
  demandesNouvelles: number;
  totalAvis: number;
}

interface WeeklyData {
  semaine: string;
  vues: number;
  premiers_contacts: number;
  affichages_tel: number;
}

function getWeekLabel(date: Date): string {
  const d = new Date(date);
  const day = d.getDate();
  const month = d.toLocaleDateString("fr-FR", { month: "short" });
  return `${day} ${month}`;
}

function getLast8Weeks(): { start: Date; label: string }[] {
  const weeks: { start: Date; label: string }[] = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    d.setHours(0, 0, 0, 0);
    // Set to Monday
    const dayOfWeek = d.getDay();
    const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    d.setDate(diff);
    weeks.push({ start: new Date(d), label: getWeekLabel(d) });
  }
  return weeks;
}

export default function PrestataireDashboard() {
  const { prestataire, loading } = usePrestataire();
  const [stats, setStats] = useState<DashboardStats>({
    totalDemandes: 0,
    demandesNouvelles: 0,
    totalAvis: 0,
  });
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);

  useEffect(() => {
    if (!prestataire?.id) return;

    async function fetchStats() {
      const [demandesRes, demandesNewRes, avisRes] = await Promise.all([
        supabase
          .from("demandes_devis")
          .select("id", { count: "exact", head: true })
          .eq("prestataire_id", prestataire!.id),
        supabase
          .from("demandes_devis")
          .select("id", { count: "exact", head: true })
          .eq("prestataire_id", prestataire!.id)
          .eq("statut", "nouveau"),
        supabase
          .from("avis")
          .select("id", { count: "exact", head: true })
          .eq("prestataire_id", prestataire!.id)
          .eq("statut", "valide"),
      ]);

      setStats({
        totalDemandes: demandesRes.count ?? 0,
        demandesNouvelles: demandesNewRes.count ?? 0,
        totalAvis: avisRes.count ?? 0,
      });
    }

    async function fetchWeekly() {
      const weeks = getLast8Weeks();
      const eightWeeksAgo = weeks[0].start.toISOString();

      const { data: events } = await supabase
        .from("evenements_prestataire")
        .select("type, created_at")
        .eq("prestataire_id", prestataire!.id)
        .gte("created_at", eightWeeksAgo)
        .order("created_at", { ascending: true });

      const result: WeeklyData[] = weeks.map((w, i) => {
        const nextStart = i < weeks.length - 1 ? weeks[i + 1].start : new Date();
        const weekEvents = (events ?? []).filter((e) => {
          const d = new Date(e.created_at);
          return d >= w.start && d < nextStart;
        });

        return {
          semaine: w.label,
          vues: weekEvents.filter((e) => e.type === "vue_profil").length,
          premiers_contacts: weekEvents.filter((e) => e.type === "premier_contact").length,
          affichages_tel: weekEvents.filter((e) => e.type === "affichage_telephone").length,
        };
      });

      setWeeklyData(result);
    }

    fetchStats();
    fetchWeekly();
  }, [prestataire?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!prestataire) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="font-serif text-2xl text-foreground mb-2">Aucune fiche prestataire</h2>
        <p className="font-sans text-muted-foreground mb-6">
          Vous n'avez pas encore de fiche prestataire associée à votre compte.
        </p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    actif: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    brouillon: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    en_attente: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    suspendu: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  const statusLabels: Record<string, string> = {
    actif: "Actif",
    brouillon: "Brouillon",
    en_attente: "En attente de validation",
    a_corriger: "À corriger",
    suspendu: "Suspendu",
    archive: "Archivé",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-serif text-2xl md:text-3xl text-foreground">
          Bonjour{prestataire.nom_commercial ? `, ${prestataire.nom_commercial}` : ""} 👋
        </h2>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-sans text-sm text-muted-foreground">Demandes reçues</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-serif text-2xl text-foreground">{stats.totalDemandes}</div>
            {stats.demandesNouvelles > 0 && (
              <p className="font-sans text-xs text-primary mt-1">
                {stats.demandesNouvelles} nouvelle{stats.demandesNouvelles > 1 ? "s" : ""}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-sans text-sm text-muted-foreground">Avis clients</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-serif text-2xl text-foreground">{stats.totalAvis}</div>
            <p className="font-sans text-xs text-muted-foreground mt-1">
              Note moyenne : {prestataire.note_moyenne?.toFixed(1) ?? "–"}/5
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-sans text-sm text-muted-foreground">Taux de réponse</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-serif text-2xl text-foreground">—</div>
            <p className="font-sans text-xs text-muted-foreground mt-1">Bientôt disponible</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Activité des 8 dernières semaines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="semaine" className="font-sans text-xs" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} className="font-sans text-xs" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line
                  type="monotone"
                  dataKey="vues"
                  name="Vues du profil"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="premiers_contacts"
                  name="Premiers contacts"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="affichages_tel"
                  name="Affichages téléphone"
                  stroke="hsl(var(--chart-3))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <Link to="/espace-pro/demandes" className="block p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-sans font-semibold text-foreground">Demandes de devis</h3>
                <p className="font-sans text-sm text-muted-foreground">
                  Consultez et répondez aux demandes
                </p>
              </div>
            </div>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <Link to="/espace-pro/avis" className="block p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Star className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-sans font-semibold text-foreground">Avis clients</h3>
                <p className="font-sans text-sm text-muted-foreground">
                  Consultez et répondez aux avis
                </p>
              </div>
            </div>
          </Link>
        </Card>
      </div>
    </div>
  );
}
