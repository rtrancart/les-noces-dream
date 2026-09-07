import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Play, X, Film } from "lucide-react";
import { formaterDuree } from "@/lib/videoThumbnail";

type Video = {
  id: string;
  url_video: string;
  url_thumbnail: string | null;
  duree_seconds: number | null;
};

interface Props {
  prestataireId: string;
  nom: string;
}

/**
 * Section vidéos de la fiche publique.
 * Aucun lecteur n'est monté avant le clic : seules les vignettes sont chargées.
 */
export default function FicheVideos({ prestataireId, nom }: Props) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [active, setActive] = useState<Video | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("prestataires_videos")
        .select("id, url_video, url_thumbnail, duree_seconds")
        .eq("prestataire_id", prestataireId)
        .order("ordre_affichage", { ascending: true });
      if (!cancelled) setVideos(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [prestataireId]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActive(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  if (videos.length === 0) return null;

  return (
    <div>
      <h2 className="font-serif text-xl font-semibold text-foreground mb-3">Vidéos</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {videos.map((v, i) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setActive(v)}
            className="group relative aspect-video overflow-hidden rounded-lg bg-secondary/40"
            aria-label={`Lire la vidéo ${i + 1} de ${nom}`}
          >
            {v.url_thumbnail ? (
              <img
                src={v.url_thumbnail}
                alt=""
                loading="lazy"
                decoding="async"
                width={640}
                height={360}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <Film className="h-7 w-7 text-muted-foreground" aria-hidden />
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-foreground/20 transition-colors group-hover:bg-foreground/35">
              <span className="rounded-full bg-background/90 p-2.5">
                <Play className="h-4 w-4 text-foreground" aria-hidden />
              </span>
            </span>
            {v.duree_seconds != null && (
              <span className="absolute bottom-2 right-2 rounded bg-foreground/70 px-1.5 py-0.5 font-sans text-[11px] text-background">
                {formaterDuree(v.duree_seconds)}
              </span>
            )}
          </button>
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setActive(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 rounded-full bg-background/90 p-2"
            aria-label="Fermer"
            onClick={() => setActive(null)}
          >
            <X className="h-5 w-5 text-foreground" />
          </button>
          <video
            src={active.url_video}
            poster={active.url_thumbnail ?? undefined}
            controls
            autoPlay
            playsInline
            className="max-h-[85vh] w-full max-w-4xl rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
