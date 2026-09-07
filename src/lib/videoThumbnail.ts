export interface VideoMeta {
  duree_seconds: number | null;
  thumbnail: Blob | null;
}

/**
 * Lit une vidéo dans le navigateur pour en extraire la durée et une vignette
 * (image capturée vers la 1re seconde).
 *
 * Certains navigateurs / encodages refusent de décoder le fichier : dans ce cas
 * on renvoie des valeurs vides plutôt que de bloquer l'envoi.
 */
export function extraireMetaVideo(file: File): Promise<VideoMeta> {
  return new Promise((resolve) => {
    const vide: VideoMeta = { duree_seconds: null, thumbnail: null };
    let done = false;
    const finish = (result: VideoMeta) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      resolve(result);
    };

    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    (video as HTMLVideoElement & { playsInline: boolean }).playsInline = true;
    video.crossOrigin = "anonymous";

    // Filet de sécurité : jamais plus de 10 s d'attente.
    const timer = window.setTimeout(() => finish(vide), 10000);

    video.onerror = () => {
      window.clearTimeout(timer);
      finish(vide);
    };

    video.onloadedmetadata = () => {
      const duree = Number.isFinite(video.duration) ? Math.round(video.duration) : null;
      const cible = duree && duree > 1 ? 1 : 0;

      video.onseeked = () => {
        window.clearTimeout(timer);
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext("2d");
          if (!ctx) return finish({ duree_seconds: duree, thumbnail: null });
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => finish({ duree_seconds: duree, thumbnail: blob }),
            "image/jpeg",
            0.8,
          );
        } catch {
          finish({ duree_seconds: duree, thumbnail: null });
        }
      };

      try {
        video.currentTime = cible;
      } catch {
        window.clearTimeout(timer);
        finish({ duree_seconds: duree, thumbnail: null });
      }
    };

    video.src = url;
  });
}

export function formaterDuree(seconds: number | null | undefined): string {
  if (!seconds && seconds !== 0) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
