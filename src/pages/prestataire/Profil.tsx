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
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

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
            <Label className="font-sans text-sm">Description courte</Label>
            <Textarea
              placeholder="Décrivez votre activité en une phrase…"
              value={form.description_courte}
              onChange={(e) => setForm((f) => ({ ...f, description_courte: e.target.value }))}
              rows={2}
            />
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
          {field("Adresse", "adresse")}
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
