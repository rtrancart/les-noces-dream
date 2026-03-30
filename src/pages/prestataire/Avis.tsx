import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePrestataire } from "@/hooks/usePrestataire";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Avis {
  id: string;
  titre: string | null;
  commentaire: string;
  note_globale: number;
  note_qualite_presta: number;
  note_professionnalisme: number;
  note_rapport_qualite_prix: number;
  note_flexibilite: number;
  reponse_prestataire: string | null;
  created_at: string;
}

function Stars({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < Math.round(rating) ? "fill-primary text-primary" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export default function PrestataireAvis() {
  const { prestataire, loading: loadingPrest } = usePrestataire();
  const [avis, setAvis] = useState<Avis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!prestataire?.id) return;

    async function fetch() {
      const { data } = await supabase
        .from("avis")
        .select("id, titre, commentaire, note_globale, note_qualite_presta, note_professionnalisme, note_rapport_qualite_prix, note_flexibilite, reponse_prestataire, created_at")
        .eq("prestataire_id", prestataire!.id)
        .eq("statut", "valide")
        .order("created_at", { ascending: false });

      setAvis(data ?? []);
      setLoading(false);
    }

    fetch();
  }, [prestataire?.id]);

  if (loadingPrest || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-foreground">Avis clients</h1>
        {prestataire && (
          <div className="flex items-center gap-2">
            <Stars rating={prestataire.note_moyenne ?? 0} />
            <span className="font-sans text-sm text-muted-foreground">
              {prestataire.note_moyenne?.toFixed(1) ?? "–"}/5 ({prestataire.nombre_avis ?? 0} avis)
            </span>
          </div>
        )}
      </div>

      {avis.length === 0 ? (
        <div className="text-center py-16">
          <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-sans text-lg text-foreground mb-1">Aucun avis pour le moment</h3>
          <p className="font-sans text-sm text-muted-foreground">
            Les avis validés de vos clients apparaîtront ici
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {avis.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    {a.titre && (
                      <h3 className="font-sans font-semibold text-foreground mb-1">{a.titre}</h3>
                    )}
                    <Stars rating={a.note_globale} />
                  </div>
                  <span className="font-sans text-xs text-muted-foreground">
                    {format(new Date(a.created_at), "d MMM yyyy", { locale: fr })}
                  </span>
                </div>

                <p className="font-sans text-sm text-foreground/80">{a.commentaire}</p>

                {/* Detail scores */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border">
                  {[
                    { label: "Qualité", note: a.note_qualite_presta },
                    { label: "Professionnalisme", note: a.note_professionnalisme },
                    { label: "Rapport qualité/prix", note: a.note_rapport_qualite_prix },
                    { label: "Flexibilité", note: a.note_flexibilite },
                  ].map((n) => (
                    <div key={n.label} className="text-center">
                      <p className="font-sans text-xs text-muted-foreground">{n.label}</p>
                      <p className="font-sans text-sm font-semibold text-foreground">{n.note}/5</p>
                    </div>
                  ))}
                </div>

                {a.reponse_prestataire && (
                  <div className="bg-secondary/30 rounded-lg p-3 mt-2">
                    <p className="font-sans text-xs font-semibold text-muted-foreground mb-1">Votre réponse</p>
                    <p className="font-sans text-sm text-foreground/80">{a.reponse_prestataire}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
