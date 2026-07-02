import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSharedPrestataire } from "@/contexts/PrestataireContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, Loader2, Send, CheckCircle2, AlertCircle } from "lucide-react";
import AddressAutocomplete from "@/components/prestataire/AddressAutocomplete";
import RaisonSocialeField from "@/components/prestataire/RaisonSocialeField";

const MAX_DESC_COURTE = 160;

export default function PrestataireProfil() {
  const { prestataire, loading, refetch } = useSharedPrestataire();
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
    latitude: null as number | null,
    longitude: null as number | null,
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
        latitude: prestataire.latitude,
        longitude: prestataire.longitude,
      });
    }
  }, [prestataire]);

  // Critères obligatoires pour soumission
  const missingFields = useMemo(() => {
    if (!prestataire) return [];
    const m: string[] = [];
    if (!prestataire.nom_commercial) m.push("Nom commercial");
    if (!prestataire.description || prestataire.description.length < 50) m.push("Description détaillée (≥ 50 caractères)");
    if (!prestataire.ville) m.push("Ville");
    if (!prestataire.region) m.push("Région");
    if (!prestataire.telephone) m.push("Téléphone");
    if (!prestataire.email_contact) m.push("Email de contact");
    if (!prestataire.photo_principale_url) m.push("Photo principale");
    if (!prestataire.prix_depart) m.push("Prix de départ");
    if (!prestataire.zones_intervention || prestataire.zones_intervention.length === 0) m.push("Zones d'intervention");
    return m;
  }, [prestataire]);

  const canSubmit = missingFields.length === 0;
  const canShowSubmit = prestataire && ["a_completer", "a_corriger"].includes(prestataire.statut);

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
        latitude: form.latitude,
        longitude: form.longitude,
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

  const handleSubmitForValidation = async () => {
    if (!prestataire || !canSubmit) return;
    if (!window.confirm("Soumettre la fiche à validation ? L'équipe éditoriale la relit sous 48h.")) return;
    setSubmitting(true);
    try {
      const { data: updated, error } = await supabase
        .from("prestataires")
        .update({ statut: "en_attente" })
        .eq("id", prestataire.id)
        .select();
      if (error) throw error;
      if (!updated || updated.length === 0) throw new Error("Mise à jour refusée");

      // Fire notification (non-blocking)
      supabase.functions.invoke("notify-nouvelle-soumission", {
        body: { prestataire_id: prestataire.id },
      }).catch((e) => console.error("notify failed", e));

      toast.success("Fiche soumise pour validation 🎉");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la soumission");
    } finally {
      setSubmitting(false);
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

      {/* Encart soumission à validation */}
      {canShowSubmit && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-champagne/10">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              {canSubmit ? (
                <CheckCircle2 className="h-5 w-5 text-sauge shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-or shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-2">
                <h3 className="font-serif text-lg">
                  {canSubmit ? "Votre fiche est prête à être soumise" : "Complétez votre fiche pour pouvoir la soumettre"}
                </h3>
                {!canSubmit && (
                  <ul className="list-disc list-inside font-sans text-sm text-muted-foreground space-y-0.5">
                    {missingFields.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                )}
                <p className="font-sans text-xs text-muted-foreground">
                  Une fois soumise, l'équipe éditoriale relit votre fiche sous 48h.
                </p>
              </div>
            </div>
            <Button onClick={handleSubmitForValidation} disabled={!canSubmit || submitting} className="gap-2 w-full sm:w-auto">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Soumettre pour validation
            </Button>
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}
