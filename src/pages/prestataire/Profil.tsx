import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePrestataire } from "@/hooks/usePrestataire";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";
import AddressAutocomplete from "@/components/prestataire/AddressAutocomplete";
import ZonesInterventionPicker from "@/components/prestataire/ZonesInterventionPicker";

const MAX_DESC_COURTE = 160;

export default function PrestataireProfil() {
  const { prestataire, loading, refetch } = usePrestataire();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nom_commercial: "",
    description_courte: "",
    description: "",
    adresse: "",
    ville: "",
    code_postal: "",
    region: "",
    telephone: "",
    email_contact: "",
    site_web: "",
    prix_depart: "",
    prix_max: "",
    latitude: null as number | null,
    longitude: null as number | null,
    zones_intervention: [] as string[],
  });

  useEffect(() => {
    if (prestataire) {
      setForm({
        nom_commercial: prestataire.nom_commercial ?? "",
        description_courte: prestataire.description_courte ?? "",
        description: prestataire.description ?? "",
        adresse: prestataire.adresse ?? "",
        ville: prestataire.ville ?? "",
        code_postal: prestataire.code_postal ?? "",
        region: prestataire.region ?? "",
        telephone: prestataire.telephone ?? "",
        email_contact: prestataire.email_contact ?? "",
        site_web: prestataire.site_web ?? "",
        prix_depart: prestataire.prix_depart?.toString() ?? "",
        prix_max: prestataire.prix_max?.toString() ?? "",
        latitude: prestataire.latitude,
        longitude: prestataire.longitude,
        zones_intervention: prestataire.zones_intervention ?? [],
      });
    }
  }, [prestataire]);

  const handleSave = async () => {
    if (!prestataire) return;
    setSaving(true);

    const { error } = await supabase
      .from("prestataires")
      .update({
        nom_commercial: form.nom_commercial,
        description_courte: form.description_courte,
        description: form.description,
        adresse: form.adresse,
        ville: form.ville,
        code_postal: form.code_postal,
        region: form.region,
        telephone: form.telephone,
        email_contact: form.email_contact,
        site_web: form.site_web,
        prix_depart: form.prix_depart ? parseInt(form.prix_depart) : null,
        prix_max: form.prix_max ? parseInt(form.prix_max) : null,
        latitude: form.latitude,
        longitude: form.longitude,
        zones_intervention: form.zones_intervention.length > 0 ? form.zones_intervention : null,
      })
      .eq("id", prestataire.id);

    setSaving(false);

    if (error) {
      toast.error("Erreur lors de la sauvegarde");
      console.error(error);
    } else {
      toast.success("Profil mis à jour avec succès");
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

  const field = (label: string, key: keyof typeof form, opts?: { type?: string; placeholder?: string }) => (
    <div className="space-y-2">
      <Label className="font-sans text-sm">{label}</Label>
      <Input
        type={opts?.type ?? "text"}
        placeholder={opts?.placeholder}
        value={form[key]?.toString() ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  const descLen = form.description_courte.length;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-foreground">Mon profil</h1>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer
        </Button>
      </div>

      {/* Informations générales */}
      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field("Nom commercial", "nom_commercial")}
          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-sans text-sm">Description courte</Label>
              <span className={`font-sans text-xs ${descLen > MAX_DESC_COURTE ? "text-destructive" : "text-muted-foreground"}`}>
                {descLen}/{MAX_DESC_COURTE}
              </span>
            </div>
            <Textarea
              placeholder="Décrivez votre activité en une phrase…"
              value={form.description_courte}
              onChange={(e) => setForm((f) => ({ ...f, description_courte: e.target.value }))}
              rows={2}
              maxLength={MAX_DESC_COURTE}
            />
            <p className="font-sans text-xs text-muted-foreground">
              Maximum {MAX_DESC_COURTE} caractères pour un affichage optimal sur 3 lignes.
            </p>
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label className="font-sans text-sm">Description détaillée</Label>
            <Textarea
              placeholder="Présentez votre activité, vos services, votre expérience…"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={6}
            />
          </div>
        </CardContent>
      </Card>

      {/* Coordonnées */}
      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Coordonnées</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label className="font-sans text-sm">Adresse</Label>
            <AddressAutocomplete
              value={form.adresse}
              onChange={(address, details) => {
                setForm((f) => ({
                  ...f,
                  adresse: address,
                  ...(details?.ville && { ville: details.ville }),
                  ...(details?.code_postal && { code_postal: details.code_postal }),
                  ...(details?.region && { region: details.region }),
                  ...(details?.latitude != null && { latitude: details.latitude }),
                  ...(details?.longitude != null && { longitude: details.longitude }),
                }));
              }}
            />
          </div>
          {field("Ville", "ville")}
          {field("Code postal", "code_postal")}
          {field("Région", "region")}
          {field("Téléphone", "telephone", { type: "tel" })}
          {field("Email de contact", "email_contact", { type: "email" })}
          <div className="md:col-span-2">
            {field("Site web", "site_web", { placeholder: "https://…" })}
          </div>
        </CardContent>
      </Card>

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
          <CardTitle className="font-sans text-lg">Tarifs</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field("Prix de départ (€)", "prix_depart", { type: "number" })}
          {field("Prix maximum (€)", "prix_max", { type: "number" })}
        </CardContent>
      </Card>
    </div>
  );
}
