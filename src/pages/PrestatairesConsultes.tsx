import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchHistorique, type HistoriqueEntry } from "@/hooks/useHistoriqueNavigation";
import HistoriqueByCategory from "@/components/historique/HistoriqueByCategory";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function PrestatairesConsultes() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<HistoriqueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [categorySlugs, setCategorySlugs] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const data = await fetchHistorique(user?.id ?? null, 20);
    setEntries(data);

    // Charger les slugs pour les liens "Voir tous les X"
    const noms = Array.from(new Set(data.map((e) => e.prestataire?.categorie_nom).filter(Boolean) as string[]));
    if (noms.length > 0) {
      const { data: cats } = await supabase
        .from("categories")
        .select("nom, slug")
        .in("nom", noms);
      const map: Record<string, string> = {};
      (cats ?? []).forEach((c: any) => (map[c.nom] = c.slug));
      setCategorySlugs(map);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const stats = useMemo(() => {
    const valid = entries.filter((e) => e.prestataire);
    const cats = new Set(valid.map((e) => e.prestataire!.categorie_nom).filter(Boolean));
    return { fiches: valid.length, categories: cats.size };
  }, [entries]);

  const clearAll = async () => {
    if (user?.id) {
      const { error } = await supabase.from("historique_navigation").delete().eq("user_id", user.id);
      if (error) {
        toast.error("Impossible de vider l'historique");
        return;
      }
    } else {
      sessionStorage.removeItem("lesnoces_historique_anonyme");
    }
    setEntries([]);
    toast.success("Historique vidé");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <nav className="font-sans text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">
              Accueil
            </Link>
            <span className="mx-1.5">›</span>
            <span>Prestataires consultés</span>
          </nav>
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-serif text-3xl sm:text-4xl text-foreground">Prestataires consultés</h1>
            {entries.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                className="text-destructive hover:text-destructive shrink-0"
                aria-label="Tout effacer"
                title="Tout effacer"
              >
                <Trash2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Tout effacer</span>
              </Button>
            )}
          </div>
        </div>

        {/* Bandeau invitation compte (anonyme uniquement) */}
        {!user && entries.length > 0 && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-sans text-sm text-foreground">
                  Créez votre espace gratuit pour retrouver votre historique sur tous vos appareils.
                </p>
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <Link to="/inscription">Créer mon compte</Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Contenu */}
        {loading ? (
          <p className="font-sans text-sm text-muted-foreground text-center py-12">Chargement…</p>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Clock className="h-10 w-10 text-muted-foreground" />
            <p className="font-sans text-base text-foreground">Aucun prestataire consulté</p>
            <p className="font-sans text-sm text-muted-foreground max-w-md">
              Parcourez nos prestataires : ils s'afficheront ici pour les retrouver facilement.
            </p>
            <Button asChild className="mt-2">
              <Link to="/recherche">Découvrir les prestataires</Link>
            </Button>
          </div>
        ) : (
          <HistoriqueByCategory entries={entries} categorySlugByName={categorySlugs} />
        )}
      </div>
    </div>
  );
}
