import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, X, Star, Loader2, ImageIcon, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  prestataireId: string;
  photoUrl: string | null;
  galerieUrls: string[];
  onUpdate: () => void;
}

interface TileProps {
  url: string;
  isMain: boolean;
  isDeleting: boolean;
  onSetMain: (url: string) => void;
  onDelete: (url: string) => void;
}

function SortablePhoto({ url, isMain, isDeleting, onSetMain, onDelete }: TileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, touchAction: "none" }}
      className={cn(
        "relative group aspect-square rounded-lg overflow-hidden border-2 select-none cursor-grab active:cursor-grabbing",
        isMain ? "border-primary" : "border-transparent",
        isDragging && "z-10 opacity-80 shadow-lg",
      )}
      {...attributes}
      {...listeners}
    >
      <img src={url} alt="" draggable={false} className="w-full h-full object-cover pointer-events-none select-none" />

      <div
        aria-hidden
        className="absolute top-1.5 right-1.5 h-6 w-6 rounded bg-background/80 text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>


      {isMain && (
        <div className="absolute top-1.5 left-1.5 bg-primary text-primary-foreground px-1.5 py-0.5 rounded text-[10px] font-sans font-medium flex items-center gap-1">
          <Star className="h-2.5 w-2.5 fill-current" /> Principale
        </div>
      )}

      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
        {!isMain && (
          <Button size="sm" variant="secondary" className="h-7 text-[11px] font-sans gap-1" onClick={() => onSetMain(url)}>
            <Star className="h-3 w-3" /> Principale
          </Button>
        )}
        <Button size="sm" variant="destructive" className="h-7 w-7 p-0" disabled={isDeleting} onClick={() => onDelete(url)}>
          {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

export default function PrestatairePhotosTab({ prestataireId, photoUrl, galerieUrls, onUpdate }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const serverPhotos = [photoUrl, ...(galerieUrls || [])].filter(Boolean) as string[];
  const [photos, setPhotos] = useState<string[]>(serverPhotos);

  useEffect(() => {
    setPhotos([photoUrl, ...(galerieUrls || [])].filter(Boolean) as string[]);
  }, [photoUrl, galerieUrls]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const persistOrder = async (ordered: string[], previous: string[]) => {
    const { data, error } = await supabase
      .from("prestataires")
      .update({
        photo_principale_url: ordered[0] ?? null,
        urls_galerie: ordered.slice(1),
      })
      .eq("id", prestataireId)
      .select("id");

    if (error || !data || data.length === 0) {
      setPhotos(previous);
      toast.error(error?.message ?? "Impossible d'enregistrer l'ordre des photos");
      return;
    }
    onUpdate();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = photos.indexOf(active.id as string);
    const newIndex = photos.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const previous = photos;
    const ordered = arrayMove(photos, oldIndex, newIndex);
    setPhotos(ordered);
    void persistOrder(ordered, previous);
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    setProgress({ done: 0, total: list.length });
    const newUrls: string[] = [];

    let done = 0;
    for (const file of list) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} n'est pas une image`);
        setProgress({ done: ++done, total: list.length });
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} dépasse 5 Mo`);
        setProgress({ done: ++done, total: list.length });
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
        setProgress({ done: ++done, total: list.length });
        continue;
      }

      const { data: urlData } = supabase.storage.from("prestataires-photos").getPublicUrl(path);
      newUrls.push(urlData.publicUrl);
      setProgress({ done: ++done, total: list.length });
    }

    if (newUrls.length === 0) {
      setUploading(false);
      setProgress(null);
      return;
    }

    const ordered = [...photos, ...newUrls];
    setPhotos(ordered);
    await persistOrder(ordered, photos);

    toast.success(`${newUrls.length} photo(s) ajoutée(s)`);
    setUploading(false);
    setProgress(null);
  };

  const setAsMain = async (url: string) => {
    if (photos[0] === url) return;
    const previous = photos;
    const ordered = [url, ...photos.filter((u) => u !== url)];
    setPhotos(ordered);
    await persistOrder(ordered, previous);
    toast.success("Photo principale mise à jour");
  };

  const deletePhoto = async (url: string) => {
    setDeleting(url);

    try {
      const bucketBase = "/prestataires-photos/";
      const idx = url.indexOf(bucketBase);
      if (idx !== -1) {
        const storagePath = decodeURIComponent(url.slice(idx + bucketBase.length));
        await supabase.storage.from("prestataires-photos").remove([storagePath]);
      }
    } catch {}

    const previous = photos;
    const ordered = photos.filter((u) => u !== url);
    setPhotos(ordered);
    await persistOrder(ordered, previous);

    toast.success("Photo supprimée");
    setDeleting(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
  };

  const mainUrl = photos[0] ?? null;

  return (
    <div
      className={cn(
        "space-y-4 pt-4 rounded-lg transition-colors",
        isDragOver && "ring-2 ring-primary ring-offset-2 bg-primary/5",
      )}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current++;
        setIsDragOver(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setIsDragOver(false);
      }}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between">
        <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">
          Photos ({photos.length})
        </Label>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 font-sans text-xs"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading && progress ? `Envoi ${progress.done}/${progress.total}` : "Ajouter des photos"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-lg">
          <ImageIcon className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-sans text-sm text-muted-foreground">Aucune photo</p>
          <p className="font-sans text-xs text-muted-foreground/60 mt-1">
            Glissez-déposez vos images ici ou cliquez sur « Ajouter des photos »
          </p>
        </div>
      ) : (
        <>
          <p className="font-sans text-xs text-muted-foreground/70">
            Glissez les vignettes pour réordonner — la première photo est la photo principale.
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={photos} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-3 gap-3">
                {photos.map((url) => (
                  <SortablePhoto
                    key={url}
                    url={url}
                    isMain={url === mainUrl}
                    isDeleting={deleting === url}
                    onSetMain={setAsMain}
                    onDelete={deletePhoto}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
}
