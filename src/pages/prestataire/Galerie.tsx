import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePrestataire } from "@/hooks/usePrestataire";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Trash2, ImageIcon, Loader2, Star } from "lucide-react";

export default function PrestataireGalerie() {
  const { prestataire, loading, refetch } = usePrestataire();
  const [uploading, setUploading] = useState(false);

  const photos = prestataire?.urls_galerie ?? [];
  const photoMain = prestataire?.photo_principale_url;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!prestataire || !e.target.files?.length) return;
    setUploading(true);

    const newUrls: string[] = [];

    for (const file of Array.from(e.target.files)) {
      const ext = file.name.split(".").pop();
      const path = `${prestataire.id}/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage
        .from("prestataires-photos")
        .upload(path, file, { upsert: true });

      if (error) {
        toast.error(`Erreur upload: ${file.name}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("prestataires-photos")
        .getPublicUrl(path);

      newUrls.push(urlData.publicUrl);
    }

    if (newUrls.length > 0) {
      const updatedGallery = [...photos, ...newUrls];
      const updateData: any = { urls_galerie: updatedGallery };

      // Set first photo as main if none exists
      if (!photoMain) {
        updateData.photo_principale_url = newUrls[0];
      }

      await supabase
        .from("prestataires")
        .update(updateData)
        .eq("id", prestataire.id);

      toast.success(`${newUrls.length} photo${newUrls.length > 1 ? "s" : ""} ajoutée${newUrls.length > 1 ? "s" : ""}`);
      refetch();
    }

    setUploading(false);
    e.target.value = "";
  };

  const setAsMain = async (url: string) => {
    if (!prestataire) return;
    await supabase
      .from("prestataires")
      .update({ photo_principale_url: url })
      .eq("id", prestataire.id);
    toast.success("Photo principale mise à jour");
    refetch();
  };

  const removePhoto = async (url: string) => {
    if (!prestataire) return;
    const updated = photos.filter((p) => p !== url);
    const updateData: any = { urls_galerie: updated };

    if (photoMain === url) {
      updateData.photo_principale_url = updated[0] ?? null;
    }

    await supabase
      .from("prestataires")
      .update(updateData)
      .eq("id", prestataire.id);

    toast.success("Photo supprimée");
    refetch();
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-foreground">Photos & galerie</h1>
        <div>
          <Label htmlFor="photo-upload" className="cursor-pointer">
            <Button asChild disabled={uploading} className="gap-2">
              <span>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Ajouter des photos
              </span>
            </Button>
          </Label>
          <Input
            id="photo-upload"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
          <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-sans text-lg text-foreground mb-1">Aucune photo</h3>
          <p className="font-sans text-sm text-muted-foreground">
            Ajoutez des photos pour mettre en valeur vos prestations
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((url, i) => (
            <Card key={i} className="overflow-hidden group relative">
              <div className="aspect-[4/3] relative">
                <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                {photoMain === url && (
                  <div className="absolute top-2 left-2">
                    <span className="bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs font-sans font-semibold flex items-center gap-1">
                      <Star className="h-3 w-3 fill-current" /> Principale
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  {photoMain !== url && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-xs gap-1"
                      onClick={() => setAsMain(url)}
                    >
                      <Star className="h-3 w-3" /> Principale
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="text-xs gap-1"
                    onClick={() => removePhoto(url)}
                  >
                    <Trash2 className="h-3 w-3" /> Supprimer
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
