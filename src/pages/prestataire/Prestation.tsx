import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { REGIONS } from "@/lib/zonesIntervention";
import { useSharedPrestataire } from "@/contexts/PrestataireContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, Loader2, ClipboardList } from "lucide-react";
import ZonesInterventionPicker from "@/components/prestataire/ZonesInterventionPicker";

function normalizeZones(zones: string[]): string[] {
  const regionMap = new Map(REGIONS.map((r) => [r.value, r.departements.map((d) => d.value)]));
  const result = new Set<string>();
  for (const z of zones) {
    if (regionMap.has(z)) {
      regionMap.get(z)!.forEach((d) => result.add(d));
    } else {
      result.add(z);
    }
  }
  return [...result];
}

export default function PrestatairePrestation() {
  const { prestataire, loading, refetch } = useSharedPrestataire();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    zones_intervention: [] as string[],
    prix_depart: "",
    prix_max: "",
  });

  useEffect(() => {
    if (prestataire) {
      setForm({
        zones_intervention: normalizeZones(prestataire.zones_intervention ?? []),
        prix_depart: prestataire.prix_depart?.toString() ?? "",
        prix_max: prestataire.prix_max?.toString() ?? "",
      });
    }
  }, [prestataire]);

  const handleSave = async () => {
    if (!prestataire) return;
    setSaving(true);

    const { error } = await supabase
      .from("prestataires")
      .update({
        zones_intervention: form.zones_intervention.length > 0 ? form.zones_intervention : null,
        prix_depart: form.prix_depart ? parseInt(form.prix_depart) : null,
        prix_max: form.prix_max ? parseInt(form.prix_max) : null,
      })
      .eq("id", prestataire.id);

    setSaving(false);

    if (error) {
      toast.error("Erreur lors de la sauvegarde");
      console.error(error);
    } else {
      toast.success("Prestation mise à jour avec succès");
      refetch();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!prestataire) {
    return <p className="text-center text-muted-foreground py-20">Aucune fiche prestataire trouvée.</p>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-foreground">Ma prestation</h1>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer
        </Button>
      </div>

      {/* Zones d'intervention */}
      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Zones d'intervention</CardTitle>
        </CardHeader>
        <CardContent>
          <ZonesInterventionPicker
            value={form.zones_intervention}
            onChange={(zones) => setForm((f) => ({ ...f, zones_intervention: zones }))}
          />
        </CardContent>
      </Card>

      {/* Tarifs */}
      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Fourchette de tarifs</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-sans text-sm">Prix de départ (€)</Label>
            <Input
              type="number"
              value={form.prix_depart}
              onChange={(e) => setForm((f) => ({ ...f, prix_depart: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label className="font-sans text-sm">Prix maximum (€)</Label>
            <Input
              type="number"
              value={form.prix_max}
              onChange={(e) => setForm((f) => ({ ...f, prix_max: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Champs spécifiques - coming soon */}
      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Détails de la prestation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 bg-secondary/30 rounded-full flex items-center justify-center mb-3">
              <ClipboardList className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-sans text-sm text-muted-foreground max-w-md">
              Les champs spécifiques à votre catégorie seront bientôt disponibles ici.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
