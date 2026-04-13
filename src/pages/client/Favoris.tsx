import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface FavoriItem {
  id: string;
  prestataire: {
    id: string;
    nom_commercial: string;
    slug: string;
    ville: string;
    region: string;
    photo_principale_url: string | null;
    note_moyenne: number | null;
    nombre_avis: number | null;
    categorie_nom?: string;
  };
}

export default function ClientFavoris() {
  const { user } = useAuth();
  const [favoris, setFavoris] = useState<FavoriItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavoris = async () => {
    if (!user?.id) return;
    setLoading(true);

    const { data } = await supabase
      .from("favoris")
      .select("id, prestataire:prestataires(id, nom_commercial, slug, ville, region, photo_principale_url, note_moyenne, nombre_avis, categorie_mere:categories(nom))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setFavoris(
      (data ?? []).map((f: any) => ({
        id: f.id,
        prestataire: {
          id: f.prestataire?.id ?? "",
          nom_commercial: f.prestataire?.nom_commercial ?? "",
          slug: f.prestataire?.slug ?? "",
          ville: f.prestataire?.ville ?? "",
          region: f.prestataire?.region ?? "",
          photo_principale_url: f.prestataire?.photo_principale_url ?? null,
          note_moyenne: f.prestataire?.note_moyenne ?? null,
          nombre_avis: f.prestataire?.nombre_avis ?? null,
          categorie_nom: f.prestataire?.categorie_mere?.nom ?? "",
        },
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchFavoris();
  }, [user?.id]);

  const removeFavori = async (favoriId: string) => {
    const { error } = await supabase.from("favoris").delete().eq("id", favoriId);
    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Favori retiré");
      setFavoris((prev) => prev.filter((f) => f.id !== favoriId));
    }
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
      <div>
        <h1 className="font-serif text-2xl text-foreground">Mes favoris</h1>
        <p className="font-sans text-sm text-muted-foreground mt-1">
          {favoris.length} prestataire{favoris.length > 1 ? "s" : ""} sauvegardé{favoris.length > 1 ? "s" : ""}
        </p>
      </div>

      {favoris.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Heart className="h-10 w-10 text-muted-foreground/30" />
            <p className="font-sans text-sm text-muted-foreground text-center">
              Vous n'avez pas encore de favoris.
            </p>
            <Link to="/recherche">
              <Button variant="outline" size="sm">Rechercher des prestataires</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {favoris.map((f) => (
            <Card key={f.id} className="overflow-hidden">
              <div className="flex gap-4 p-4">
                <Link
                  to={`/prestataire/${f.prestataire.slug}`}
                  className="h-20 w-20 rounded-md bg-secondary overflow-hidden shrink-0"
                >
                  {f.prestataire.photo_principale_url ? (
                    <img
                      src={f.prestataire.photo_principale_url}
                      alt={f.prestataire.nom_commercial}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Star className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/prestataire/${f.prestataire.slug}`}
                    className="font-sans text-sm font-medium text-foreground hover:text-primary block truncate"
                  >
                    {f.prestataire.nom_commercial}
                  </Link>
                  <p className="font-sans text-xs text-muted-foreground mt-0.5">
                    {f.prestataire.categorie_nom} · {f.prestataire.ville}
                  </p>
                  {f.prestataire.note_moyenne != null && f.prestataire.note_moyenne > 0 && (
                    <p className="font-sans text-xs text-primary mt-1">
                      ★ {f.prestataire.note_moyenne.toFixed(1)} ({f.prestataire.nombre_avis} avis)
                    </p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Link to={`/prestataire/${f.prestataire.slug}`}>
                      <Button size="sm" variant="default" className="h-7 text-xs px-3">
                        Voir la fiche
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFavori(f.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
