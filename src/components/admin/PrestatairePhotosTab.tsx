import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, X, Star, Loader2, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  prestataireId: string;
  photoUrl: string | null;
  galerieUrls: string[];
  onUpdate: () => void;
}

export default function PrestatairePhotosTab({ prestataireId, photoUrl, galerieUrls, onUpdate }: Props) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allPhotos = [photoUrl, ...(galerieUrls || [])].filter(Boolean) as string[];

  const uploadFiles = async (files: FileList) => {
    if (files.length === 0) return;
    setUploading(true);
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} n'est pas une image`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} dépasse 5 Mo`);
        continue;
      }

      const ext = file.name.split(".").pop() || "jpg";
      const path = `${prestataireId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage.from("prestataires-photos").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (error) {
        toast.error(`Erreur upload ${file.name}: ${error.message}`);
        continue;
      }

      const { data: urlData } = supabase.storage.from("prestataires-photos").getPublicUrl(path);
      newUrls.push(urlData.publicUrl);
    }

    if (newUrls.length === 0) {
      setUploading(false);
      return;
    }

    // If no main photo, set first uploaded as main
    const currentMain = photoUrl;
    const currentGalerie = galerieUrls || [];

    if (!currentMain) {
      const [main, ...rest] = newUrls;
      await supabase.from("prestataires").update({
        photo_principale_url: main,
        urls_galerie: [...currentGalerie, ...rest],
      }).eq("id", prestataireId);
    } else {
      await supabase.from("prestataires").update({
        urls_galerie: [...currentGalerie, ...newUrls],
      }).eq("id", prestataireId);
    }

    toast.success(`${newUrls.length} photo(s) ajoutée(s)`);
    setUploading(false);
    onUpdate();
  };

  const setAsMain = async (url: string) => {
    if (url === photoUrl) return;
    const currentGalerie = galerieUrls || [];
    // Remove url from galerie, add old main to galerie
    const newGalerie = currentGalerie.filter((u) => u !== url);
    if (photoUrl) newGalerie.unshift(photoUrl);

    await supabase.from("prestataires").update({
      photo_principale_url: url,
      urls_galerie: newGalerie,
    }).eq("id", prestataireId);

    toast.success("Photo principale mise à jour");
    onUpdate();
  };

  const deletePhoto = async (url: string) => {
    setDeleting(url);

    // Try to extract storage path and delete from bucket
    try {
      const bucketBase = "/prestataires-photos/";
      const idx = url.indexOf(bucketBase);
      if (idx !== -1) {
        const storagePath = decodeURIComponent(url.slice(idx + bucketBase.length));
        await supabase.storage.from("prestataires-photos").remove([storagePath]);
      }
    } catch {}

    // Update prestataire record
    if (url === photoUrl) {
      const newGalerie = [...(galerieUrls || [])];
      const newMain = newGalerie.shift() || null;
      await supabase.from("prestataires").update({
        photo_principale_url: newMain,
        urls_galerie: newGalerie,
      }).eq("id", prestataireId);
    } else {
      await supabase.from("prestataires").update({
        urls_galerie: (galerieUrls || []).filter((u) => u !== url),
      }).eq("id", prestataireId);
    }

    toast.success("Photo supprimée");
    setDeleting(null);
    onUpdate();
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">
          Photos ({allPhotos.length})
        </Label>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 font-sans text-xs"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Ajouter des photos
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {allPhotos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-lg">
          <ImageIcon className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-sans text-sm text-muted-foreground">Aucune photo</p>
          <p className="font-sans text-xs text-muted-foreground/60 mt-1">Cliquez sur « Ajouter des photos » pour commencer</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {allPhotos.map((url) => {
            const isMain = url === photoUrl;
            const isDeleting = deleting === url;
            return (
              <div key={url} className={cn("relative group aspect-square rounded-lg overflow-hidden border-2", isMain ? "border-primary" : "border-transparent")}>
                <img src={url} alt="" className="w-full h-full object-cover" />
                {isMain && (
                  <div className="absolute top-1.5 left-1.5 bg-primary text-primary-foreground px-1.5 py-0.5 rounded text-[10px] font-sans font-medium flex items-center gap-1">
                    <Star className="h-2.5 w-2.5 fill-current" /> Principale
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  {!isMain && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-[11px] font-sans gap-1"
                      onClick={() => setAsMain(url)}
                    >
                      <Star className="h-3 w-3" /> Principale
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 w-7 p-0"
                    disabled={isDeleting}
                    onClick={() => deletePhoto(url)}
                  >
                    {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
