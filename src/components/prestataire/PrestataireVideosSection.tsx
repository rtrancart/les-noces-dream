import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, Trash2, Loader2, GripVertical, Film, Info } from "lucide-react";
import PremiumBanner from "@/components/prestataire/PremiumBanner";
import { uploadWithProgress } from "@/lib/uploadWithProgress";
import { extraireMetaVideo, formaterDuree } from "@/lib/videoThumbnail";
import type { Tables } from "@/integrations/supabase/types";

type Video = Tables<"prestataires_videos">;

const MAX_VIDEOS = 10;
const MAX_SIZE = 30 * 1024 * 1024;
const BUCKET = "prestataires-videos";

interface Props {
  prestataireId: string;
  estPremium: boolean;
}

function SortableVideo({
  video,
  onDelete,
  deleting,
}: {
  video: Video;
  onDelete: (v: Video) => void;
  deleting: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: video.id,
  });

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`overflow-hidden relative group ${isDragging ? "opacity-60 z-10" : ""}`}
    >
      <div className="aspect-video relative bg-muted">
        {video.url_thumbnail ? (
          <img
            src={video.url_thumbnail}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="h-8 w-8 text-muted-foreground" aria-hidden />
          </div>
        )}
        {video.duree_seconds != null && (
          <span className="absolute bottom-2 right-2 rounded bg-foreground/70 px-1.5 py-0.5 font-sans text-[11px] text-background">
            {formaterDuree(video.duree_seconds)}
          </span>
        )}
        <button
          type="button"
          className="absolute top-2 left-2 rounded bg-background/85 p-1 cursor-grab active:cursor-grabbing"
          aria-label="Réorganiser"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-foreground" />
        </button>
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-foreground/0 opacity-0 transition-all group-hover:bg-foreground/40 group-hover:opacity-100">
          <Button
            size="sm"
            variant="secondary"
            className="text-xs"
            onClick={() => window.open(video.url_video, "_blank", "noopener")}
          >
            Lire
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="text-xs gap-1"
            disabled={deleting}
            onClick={() => onDelete(video)}
          >
            <Trash2 className="h-3 w-3" /> Supprimer
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function PrestataireVideosSection({ prestataireId, estPremium }: Props) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentName, setCurrentName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("prestataires_videos")
      .select("*")
      .eq("prestataire_id", prestataireId)
      .order("ordre_affichage", { ascending: true });
    setVideos(data ?? []);
    setLoading(false);
  }, [prestataireId]);

  useEffect(() => {
    load();
  }, [load]);

  const storagePathFromUrl = (url: string) => {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const i = url.indexOf(marker);
    return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    if (videos.length + files.length > MAX_VIDEOS) {
      toast.error(`Maximum ${MAX_VIDEOS} vidéos par fiche.`);
      return;
    }

    setUploading(true);
    let ordre = videos.length > 0 ? Math.max(...videos.map((v) => v.ordre_affichage)) + 1 : 0;

    for (const file of files) {
      setCurrentName(file.name);
      setProgress(0);

      if (file.type !== "video/mp4") {
        toast.error(`${file.name} : format non accepté (MP4 uniquement).`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name} : dépasse 30 Mo.`);
        continue;
      }

      const meta = await extraireMetaVideo(file);

      const base = `${prestataireId}/${crypto.randomUUID()}`;
      const videoPath = `${base}.mp4`;

      const { error } = await uploadWithProgress(BUCKET, videoPath, file, setProgress);
      if (error) {
        toast.error(`${file.name} : ${error}`);
        continue;
      }

      let thumbUrl: string | null = null;
      if (meta.thumbnail) {
        const thumbPath = `${base}-thumb.jpg`;
        const { error: thumbError } = await supabase.storage
          .from(BUCKET)
          .upload(thumbPath, meta.thumbnail, { upsert: true, contentType: "image/jpeg" });
        if (!thumbError) {
          thumbUrl = supabase.storage.from(BUCKET).getPublicUrl(thumbPath).data.publicUrl;
        }
      }

      const videoUrl = supabase.storage.from(BUCKET).getPublicUrl(videoPath).data.publicUrl;

      const { error: insertError } = await supabase.from("prestataires_videos").insert({
        prestataire_id: prestataireId,
        url_video: videoUrl,
        url_thumbnail: thumbUrl,
        duree_seconds: meta.duree_seconds,
        taille_bytes: file.size,
        ordre_affichage: ordre,
      });

      if (insertError) {
        await supabase.storage.from(BUCKET).remove([videoPath]);
        toast.error(insertError.message);
        continue;
      }

      ordre += 1;
      toast.success(`${file.name} ajoutée`);
    }

    setUploading(false);
    setCurrentName("");
    setProgress(0);
    load();
  };

  const handleDelete = async (video: Video) => {
    setDeletingId(video.id);
    const { error } = await supabase.from("prestataires_videos").delete().eq("id", video.id).select();
    if (error) {
      toast.error("Suppression impossible");
      setDeletingId(null);
      return;
    }
    const paths = [storagePathFromUrl(video.url_video), video.url_thumbnail && storagePathFromUrl(video.url_thumbnail)]
      .filter(Boolean) as string[];
    if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
    setDeletingId(null);
    toast.success("Vidéo supprimée");
    load();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = videos.findIndex((v) => v.id === active.id);
    const newIndex = videos.findIndex((v) => v.id === over.id);
    const reordered = arrayMove(videos, oldIndex, newIndex);
    setVideos(reordered);

    const updates = reordered.map((v, i) =>
      supabase.from("prestataires_videos").update({ ordre_affichage: i }).eq("id", v.id).select(),
    );
    const results = await Promise.all(updates);
    if (results.some((r) => r.error)) {
      toast.error("Ordre non enregistré");
      load();
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-serif text-xl text-foreground">Vidéos</h2>
          <p className="font-sans text-sm text-muted-foreground flex items-start gap-1.5">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Format MP4, 30 Mo maximum par vidéo, {MAX_VIDEOS} vidéos au total.
              Une vignette est générée automatiquement.
            </span>
          </p>
        </div>
        <div>
          <Label htmlFor="video-upload" className="cursor-pointer">
            <Button
              asChild
              disabled={uploading || !estPremium || videos.length >= MAX_VIDEOS}
              className="gap-2"
            >
              <span>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Ajouter une vidéo
              </span>
            </Button>
          </Label>
          <Input
            id="video-upload"
            ref={inputRef}
            type="file"
            accept="video/mp4"
            multiple
            className="hidden"
            disabled={uploading || !estPremium || videos.length >= MAX_VIDEOS}
            onChange={handleUpload}
          />
        </div>
      </div>

      {!estPremium && (
        <PremiumBanner
          titre="Les vidéos sont réservées à la formule Premium"
          description="Passez en Premium pour présenter vos réalisations en vidéo sur votre fiche publique."
        />
      )}

      {uploading && (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between font-sans text-xs text-muted-foreground">
            <span className="truncate">{currentName}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      {loading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
          <Film className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-sans text-sm text-muted-foreground">Aucune vidéo pour le moment</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={videos.map((v) => v.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map((video) => (
                <SortableVideo
                  key={video.id}
                  video={video}
                  onDelete={handleDelete}
                  deleting={deletingId === video.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
