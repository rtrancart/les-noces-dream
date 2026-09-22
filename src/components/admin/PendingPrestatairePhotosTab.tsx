import { useRef, useState } from "react";
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
import { GripVertical, ImageIcon, Star, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface PendingPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

interface Props {
  photos: PendingPhoto[];
  onChange: (photos: PendingPhoto[]) => void;
}

function PendingPhotoTile({ photo, isMain, onSetMain, onDelete }: {
  photo: PendingPhoto;
  isMain: boolean;
  onSetMain: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });

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
      <img src={photo.previewUrl} alt="" draggable={false} className="w-full h-full object-cover pointer-events-none select-none" />
      <div aria-hidden className="absolute top-1.5 right-1.5 h-6 w-6 rounded bg-background/80 text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      {isMain && (
        <div className="absolute top-1.5 left-1.5 bg-primary text-primary-foreground px-1.5 py-0.5 rounded text-[10px] font-sans font-medium flex items-center gap-1">
          <Star className="h-2.5 w-2.5 fill-current" /> Principale
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
        {!isMain && (
          <Button
            size="sm"
            variant="secondary"
            className="pointer-events-auto h-7 text-[11px] font-sans gap-1"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onSetMain}
          >
            <Star className="h-3 w-3" /> Principale
          </Button>
        )}
        <Button
          size="sm"
          variant="destructive"
          className="pointer-events-auto h-7 w-7 p-0"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onDelete}
          aria-label={`Retirer ${photo.file.name}`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function PendingPrestatairePhotosTab({ photos, onChange }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addFiles = (files: FileList | File[]) => {
    const accepted: PendingPhoto[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} n'est pas une image`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} dépasse 5 Mo`);
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    if (accepted.length > 0) onChange([...photos, ...accepted]);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = photos.findIndex((photo) => photo.id === active.id);
    const newIndex = photos.findIndex((photo) => photo.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(photos, oldIndex, newIndex));
  };

  const removePhoto = (photo: PendingPhoto) => {
    URL.revokeObjectURL(photo.previewUrl);
    onChange(photos.filter((item) => item.id !== photo.id));
  };

  return (
    <div
      className={cn("space-y-4 pt-4 rounded-lg transition-colors", isDragOver && "ring-2 ring-primary ring-offset-2 bg-primary/5")}
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepth.current += 1;
        setIsDragOver(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setIsDragOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setIsDragOver(false);
        if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
      }}
    >
      <div className="flex items-center justify-between">
        <Label className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Photos ({photos.length})</Label>
        <Button variant="outline" size="sm" className="gap-2 font-sans text-xs" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> Ajouter des photos
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-lg">
          <ImageIcon className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-sans text-sm text-muted-foreground">Aucune photo</p>
          <p className="font-sans text-xs text-muted-foreground/60 mt-1">Glissez-déposez vos images ici ou cliquez sur « Ajouter des photos »</p>
        </div>
      ) : (
        <>
          <p className="font-sans text-xs text-muted-foreground/70">Glissez les vignettes pour réordonner — la première photo sera la photo principale.</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={photos.map((photo) => photo.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-3 gap-3">
                {photos.map((photo, index) => (
                  <PendingPhotoTile
                    key={photo.id}
                    photo={photo}
                    isMain={index === 0}
                    onSetMain={() => onChange([photo, ...photos.filter((item) => item.id !== photo.id)])}
                    onDelete={() => removePhoto(photo)}
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