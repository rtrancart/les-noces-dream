import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, MessageSquare, Calendar, Star } from "lucide-react";
import BudgetModule from "@/components/client/BudgetModule";

interface DashboardStats {
  favorisCount: number;
  demandesCount: number;
  messagesNonLus: number;
}

interface RecentFavori {
  id: string;
  prestataire: {
    id: string;
    nom_commercial: string;
    slug: string;
    ville: string;
    photo_principale_url: string | null;
    categorie_nom?: string;
  };
}

interface RecentDemande {
  id: string;
  nom_contact: string;
  statut: string;
  created_at: string;
  prestataire: {
    nom_commercial: string;
    slug: string;
  };
}

export default function ClientDashboard() {
  const { profile, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({ favorisCount: 0, demandesCount: 0, messagesNonLus: 0 });
  const [recentFavoris, setRecentFavoris] = useState<RecentFavori[]>([]);
  const [recentDemandes, setRecentDemandes] = useState<RecentDemande[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchData = async () => {
      setLoading(true);

      const [favRes, demRes] = await Promise.all([
        supabase
          .from("favoris")
          .select("id, created_at, prestataire:prestataires(id, nom_commercial, slug, ville, photo_principale_url, categorie_mere:categories!prestataires_categorie_mere_id_fkey(nom))")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("demandes_devis")
          .select("id, nom_contact, statut, created_at, prestataire:prestataires(nom_commercial, slug)")
          .eq("profile_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const favoris = (favRes.data ?? []) as any[];
      const demandes = (demRes.data ?? []) as any[];

      setStats({
        favorisCount: favoris.length,
        demandesCount: demandes.length,
        messagesNonLus: 0,
      });

      setRecentFavoris(
        favoris.map((f: any) => ({
          id: f.id,
          prestataire: {
            id: f.prestataire?.id ?? "",
            nom_commercial: f.prestataire?.nom_commercial ?? "",
            slug: f.prestataire?.slug ?? "",
            ville: f.prestataire?.ville ?? "",
            photo_principale_url: f.prestataire?.photo_principale_url ?? null,
            categorie_nom: f.prestataire?.categorie_mere?.nom ?? "",
          },
        }))
      );

      setRecentDemandes(
        demandes.map((d: any) => ({
          id: d.id,
          nom_contact: d.nom_contact,
          statut: d.statut,
          created_at: d.created_at,
          prestataire: {
            nom_commercial: d.prestataire?.nom_commercial ?? "",
            slug: d.prestataire?.slug ?? "",
          },
        }))
      );

      setLoading(false);
    };

    fetchData();
  }, [user?.id]);

  const prenom = profile?.prenom ?? "là";

  const kpis = [
    { label: "Favoris", value: stats.favorisCount, icon: Heart, sub: "prestataires sauvegardés" },
    { label: "Demandes envoyées", value: stats.demandesCount, icon: Calendar, sub: "demandes de devis" },
    { label: "Messages non lus", value: stats.messagesNonLus, icon: MessageSquare, sub: "conversations" },
  ];

  const statutLabel: Record<string, string> = {
    nouveau: "Envoyée",
    lu: "Lue",
    en_discussion: "En discussion",
    devis_envoye: "Devis reçu",
    accepte: "Acceptée",
    refuse: "Refusée",
    archive: "Archivée",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="font-serif text-2xl text-foreground">
          Bonjour {prenom} 👋
        </h1>
        <p className="font-sans text-sm text-muted-foreground mt-1">
          Bienvenue dans votre espace personnel
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="bg-secondary/50 border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                  <kpi.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-sans text-xs text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                  <p className="font-sans text-xl font-medium text-foreground leading-tight">{kpi.value}</p>
                  <p className="font-sans text-xs text-muted-foreground">{kpi.sub}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two columns: Recent Demandes + Recent Favoris */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dernières demandes */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-sans text-sm">Dernières demandes</CardTitle>
              <Link to="/mon-compte/messagerie" className="font-sans text-xs text-primary hover:underline">
                Voir tout →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-0">
            {recentDemandes.length === 0 ? (
              <p className="font-sans text-xs text-muted-foreground text-center py-6">
                Aucune demande de devis pour le moment
              </p>
            ) : (
              recentDemandes.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <Link
                      to={`/prestataire/${d.prestataire.slug}`}
                      className="font-sans text-sm font-medium text-foreground hover:text-primary truncate block"
                    >
                      {d.prestataire.nom_commercial}
                    </Link>
                    <p className="font-sans text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <span className="font-sans text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">
                    {statutLabel[d.statut] ?? d.statut}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Derniers favoris */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-sans text-sm">Derniers favoris</CardTitle>
              <Link to="/mon-compte/favoris" className="font-sans text-xs text-primary hover:underline">
                Voir tout →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-0">
            {recentFavoris.length === 0 ? (
              <p className="font-sans text-xs text-muted-foreground text-center py-6">
                Aucun favori pour le moment.{" "}
                <Link to="/recherche" className="text-primary hover:underline">Rechercher des prestataires</Link>
              </p>
            ) : (
              recentFavoris.map((f) => (
                <div key={f.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                  <div className="h-9 w-9 rounded-md bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                    {f.prestataire.photo_principale_url ? (
                      <img
                        src={f.prestataire.photo_principale_url}
                        alt={f.prestataire.nom_commercial}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Star className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/prestataire/${f.prestataire.slug}`}
                      className="font-sans text-sm font-medium text-foreground hover:text-primary truncate block"
                    >
                      {f.prestataire.nom_commercial}
                    </Link>
                    <p className="font-sans text-xs text-muted-foreground truncate">
                      {f.prestataire.categorie_nom} · {f.prestataire.ville}
                    </p>
                  </div>
                  <Link
                    to={`/prestataire/${f.prestataire.slug}`}
                    className="font-sans text-xs px-3 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
                  >
                    Voir
                  </Link>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budget */}
      <BudgetModule />
    </div>
  );
}
