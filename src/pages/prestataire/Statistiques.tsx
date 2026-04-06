import { useSharedPrestataire } from "@/contexts/PrestataireContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default function PrestataireStatistiques() {
  const { prestataire, loading } = useSharedPrestataire();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl text-foreground">Statistiques</h1>

      <div className="text-center py-16">
        <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-sans text-lg text-foreground mb-1">Bientôt disponible</h3>
        <p className="font-sans text-sm text-muted-foreground">
          Les statistiques détaillées (vues, clics, conversions) seront disponibles prochainement
        </p>
      </div>
    </div>
  );
}
