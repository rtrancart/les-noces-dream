import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import {
  Store, FileText, Star, Users, TrendingUp, Clock,
  AlertCircle, ArrowRight, Eye, CheckCircle2, XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Prestataire = Database["public"]["Tables"]["prestataires"]["Row"];
type Demande = Database["public"]["Tables"]["demandes_devis"]["Row"];
type Avis = Database["public"]["Tables"]["avis"]["Row"];

interface Stats {
  prestataires: number;
  prestatairesActifs: number;
  prestatairesEnAttente: number;
  demandes: number;
  demandesNouvelles: number;
  avis: number;
  avisEnAttente: number;
  utilisateurs: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    prestataires: 0, prestatairesActifs: 0, prestatairesEnAttente: 0,
    demandes: 0, demandesNouvelles: 0,
    avis: 0, avisEnAttente: 0, utilisateurs: 0,
  });
  const [recentDemandes, setRecentDemandes] = useState<Demande[]>([]);
  const [pendingAvis, setPendingAvis] = useState<Avis[]>([]);
  const [pendingPrestataires, setPendingPrestataires] = useState<Prestataire[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const [
        pTotal, pActifs, pAttente,
        dTotal, dNouvelles, dRecent,
        aTotal, aAttente, aPending,
        uTotal,
      ] = await Promise.all([
        supabase.from("prestataires").select("id", { count: "exact", head: true }),
        supabase.from("prestataires").select("id", { count: "exact", head: true }).eq("statut", "actif"),
        supabase.from("prestataires").select("id", { count: "exact", head: true }).eq("statut", "en_attente"),
        supabase.from("demandes_devis").select("id", { count: "exact", head: true }),
        supabase.from("demandes_devis").select("id", { count: "exact", head: true }).eq("statut", "nouveau"),
        supabase.from("demandes_devis").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("avis").select("id", { count: "exact", head: true }),
        supabase.from("avis").select("id", { count: "exact", head: true }).eq("statut", "en_attente"),
        supabase.from("avis").select("*").eq("statut", "en_attente").order("created_at", { ascending: false }).limit(5),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);

      setStats({
        prestataires: pTotal.count ?? 0,
        prestatairesActifs: pActifs.count ?? 0,
        prestatairesEnAttente: pAttente.count ?? 0,
        demandes: dTotal.count ?? 0,
        demandesNouvelles: dNouvelles.count ?? 0,
        avis: aTotal.count ?? 0,
        avisEnAttente: aAttente.count ?? 0,
        utilisateurs: uTotal.count ?? 0,
      });
      setRecentDemandes(dRecent.data ?? []);
      setPendingAvis(aPending.data ?? []);

      // Fetch pending prestataires separately
      const { data: pendingP } = await supabase
        .from("prestataires").select("*")
        .eq("statut", "en_attente")
        .order("created_at", { ascending: false }).limit(5);
      setPendingPrestataires(pendingP ?? []);

      setLoading(false);
    };
    fetchAll();
  }, []);

  const StatCard = ({ label, value, subValue, icon: Icon, iconColor, onClick }: {
    label: string; value: number; subValue?: string; icon: any; iconColor: string; onClick?: () => void;
  }) => (
    <Card className="shadow-card hover:shadow-elevated transition-shadow cursor-pointer group" onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            {loading ? (
              <div className="mt-2 h-9 w-16 animate-pulse rounded bg-muted/30" />
            ) : (
              <p className="mt-1 text-3xl font-serif font-bold text-foreground">{value}</p>
            )}
            {subValue && !loading && (
              <p className="mt-1 font-sans text-xs text-muted-foreground">{subValue}</p>
            )}
          </div>
          <div className={`rounded-lg p-2.5 ${iconColor} transition-transform group-hover:scale-110`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const statutDemandeColors: Record<string, string> = {
    nouveau: "bg-primary/15 text-primary",
    lu: "bg-accent/15 text-accent-foreground",
    en_discussion: "bg-champagne/30 text-foreground",
    devis_envoye: "bg-bleu-petrole/15 text-bleu-petrole",
    accepte: "bg-sauge/20 text-sauge",
    refuse: "bg-destructive/10 text-destructive",
    archive: "bg-muted/40 text-muted-foreground",
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-semibold text-foreground">Tableau de bord</h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">Vue d'ensemble de votre plateforme</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Prestataires"
          value={stats.prestataires}
          subValue={`${stats.prestatairesActifs} actifs · ${stats.prestatairesEnAttente} en attente`}
          icon={Store}
          iconColor="bg-primary/10 text-primary"
          onClick={() => navigate("/admin/prestataires")}
        />
        <StatCard
          label="Demandes de devis"
          value={stats.demandes}
          subValue={stats.demandesNouvelles > 0 ? `${stats.demandesNouvelles} nouvelle${stats.demandesNouvelles > 1 ? "s" : ""}` : "Toutes traitées"}
          icon={FileText}
          iconColor="bg-accent/10 text-accent"
          onClick={() => navigate("/admin/demandes")}
        />
        <StatCard
          label="Avis"
          value={stats.avis}
          subValue={stats.avisEnAttente > 0 ? `${stats.avisEnAttente} à modérer` : "Tous modérés"}
          icon={Star}
          iconColor="bg-champagne/30 text-or-riche"
          onClick={() => navigate("/admin/avis")}
        />
        <StatCard
          label="Utilisateurs"
          value={stats.utilisateurs}
          icon={Users}
          iconColor="bg-bleu-petrole/10 text-bleu-petrole"
          onClick={() => navigate("/admin/utilisateurs")}
        />
      </div>

      {/* Alerts */}
      {!loading && (stats.prestatairesEnAttente > 0 || stats.avisEnAttente > 0 || stats.demandesNouvelles > 0) && (
        <Card className="border-primary/20 bg-primary/5 shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-primary shrink-0" />
              <div className="flex flex-wrap gap-x-6 gap-y-1 font-sans text-sm">
                {stats.prestatairesEnAttente > 0 && (
                  <button onClick={() => navigate("/admin/prestataires")} className="text-foreground hover:text-primary transition-colors">
                    <strong>{stats.prestatairesEnAttente}</strong> prestataire{stats.prestatairesEnAttente > 1 ? "s" : ""} en attente de validation
                  </button>
                )}
                {stats.avisEnAttente > 0 && (
                  <button onClick={() => navigate("/admin/avis")} className="text-foreground hover:text-primary transition-colors">
                    <strong>{stats.avisEnAttente}</strong> avis à modérer
                  </button>
                )}
                {stats.demandesNouvelles > 0 && (
                  <button onClick={() => navigate("/admin/demandes")} className="text-foreground hover:text-primary transition-colors">
                    <strong>{stats.demandesNouvelles}</strong> nouvelle{stats.demandesNouvelles > 1 ? "s" : ""} demande{stats.demandesNouvelles > 1 ? "s" : ""}
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Demandes */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-serif text-base font-semibold">Dernières demandes</CardTitle>
              <Button variant="ghost" size="sm" className="font-sans text-xs text-muted-foreground gap-1" onClick={() => navigate("/admin/demandes")}>
                Voir tout <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded bg-muted/20" />
                ))}
              </div>
            ) : recentDemandes.length === 0 ? (
              <div className="py-8 text-center font-sans text-sm text-muted-foreground">
                <Clock className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                Aucune demande pour le moment
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentDemandes.map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/5 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-sm font-medium text-foreground truncate">{d.nom_contact}</p>
                      <p className="font-sans text-xs text-muted-foreground">{d.email_contact}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <Badge className={`${statutDemandeColors[d.statut] ?? "bg-muted/40 text-muted-foreground"} font-sans text-[10px] font-normal capitalize shrink-0`}>
                        {d.statut.replace(/_/g, " ")}
                      </Badge>
                      <span className="font-sans text-[10px] text-muted-foreground whitespace-nowrap">
                        {format(new Date(d.created_at), "dd MMM", { locale: fr })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Avis */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-serif text-base font-semibold">Avis en attente</CardTitle>
              <Button variant="ghost" size="sm" className="font-sans text-xs text-muted-foreground gap-1" onClick={() => navigate("/admin/avis")}>
                Voir tout <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded bg-muted/20" />
                ))}
              </div>
            ) : pendingAvis.length === 0 ? (
              <div className="py-8 text-center font-sans text-sm text-muted-foreground">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-sauge/40" />
                Tous les avis sont modérés
              </div>
            ) : (
              <div className="divide-y divide-border">
                {pendingAvis.map((a) => (
                  <div key={a.id} className="px-5 py-3 hover:bg-muted/5 transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="font-sans text-sm font-medium text-foreground truncate">{a.titre ?? "Sans titre"}</p>
                      <div className="flex items-center gap-1 ml-2">
                        <Star className="h-3 w-3 text-or-riche fill-or-riche" />
                        <span className="font-sans text-xs font-medium text-foreground">{a.note_globale.toFixed(1)}</span>
                      </div>
                    </div>
                    <p className="mt-0.5 font-sans text-xs text-muted-foreground line-clamp-1">{a.commentaire}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Prestataires */}
      {!loading && pendingPrestataires.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-serif text-base font-semibold">Prestataires en attente de validation</CardTitle>
              <Button variant="ghost" size="sm" className="font-sans text-xs text-muted-foreground gap-1" onClick={() => navigate("/admin/prestataires")}>
                Voir tout <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {pendingPrestataires.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/5 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-sm font-medium text-foreground">{p.nom_commercial}</p>
                    <p className="font-sans text-xs text-muted-foreground">{p.ville} · {p.region}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <Badge className="bg-champagne/30 text-foreground font-sans text-[10px] font-normal">En attente</Badge>
                    <span className="font-sans text-[10px] text-muted-foreground">
                      {format(new Date(p.created_at), "dd MMM", { locale: fr })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base font-semibold">Actions rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="justify-start gap-2 font-sans text-sm h-auto py-3" onClick={() => navigate("/admin/prestataires")}>
              <Store className="h-4 w-4 text-primary" />
              <div className="text-left">
                <p className="font-medium">Nouveau prestataire</p>
                <p className="text-[10px] text-muted-foreground font-normal">Ajouter une fiche</p>
              </div>
            </Button>
            <Button variant="outline" className="justify-start gap-2 font-sans text-sm h-auto py-3" onClick={() => navigate("/admin/categories")}>
              <TrendingUp className="h-4 w-4 text-accent" />
              <div className="text-left">
                <p className="font-medium">Gérer catégories</p>
                <p className="text-[10px] text-muted-foreground font-normal">Arborescence services</p>
              </div>
            </Button>
            <Button variant="outline" className="justify-start gap-2 font-sans text-sm h-auto py-3" onClick={() => navigate("/admin/articles")}>
              <FileText className="h-4 w-4 text-or-riche" />
              <div className="text-left">
                <p className="font-medium">Nouvel article</p>
                <p className="text-[10px] text-muted-foreground font-normal">Rédiger du contenu</p>
              </div>
            </Button>
            <Button variant="outline" className="justify-start gap-2 font-sans text-sm h-auto py-3" onClick={() => navigate("/admin/utilisateurs")}>
              <Users className="h-4 w-4 text-bleu-petrole" />
              <div className="text-left">
                <p className="font-medium">Utilisateurs</p>
                <p className="text-[10px] text-muted-foreground font-normal">Gérer les rôles</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
