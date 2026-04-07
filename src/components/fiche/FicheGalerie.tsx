import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  photoUrl: string | null;
  galerie: string[];
  nom: string;
}

export default function FicheGalerie({ photoUrl, galerie, nom }: Props) {
  const images = [photoUrl, ...galerie].filter(Boolean) as string[];
  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (images.length === 0) {
    return (
      <div className="aspect-[16/9] md:aspect-[2/1] bg-secondary/30 rounded-xl flex items-center justify-center">
        <span className="text-muted-foreground text-sm">Aucune photo</span>
      </div>
    );
  }

  const prev = () => setCurrent((c) => (c - 1 + images.length) % images.length);
  const next = () => setCurrent((c) => (c + 1) % images.length);

  return (
    <>
      {/* Mobile: carousel */}
      <div className="md:hidden relative">
        <div className="aspect-[4/3] overflow-hidden rounded-xl">
          <img
            src={images[current]}
            alt={`${nom} - photo ${current + 1}`}
            className="w-full h-full object-cover cursor-pointer"
            onClick={() => setLightbox(current)}
          />
        </div>
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-card/80 backdrop-blur-sm rounded-full p-1.5 shadow-soft"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-card/80 backdrop-blur-sm rounded-full p-1.5 shadow-soft"
            >
              <ChevronRight size={20} />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    i === current ? "bg-card" : "bg-card/50"
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Desktop: grid */}
      <div className="hidden md:grid gap-2 rounded-xl overflow-hidden" style={{
        gridTemplateColumns: images.length >= 3 ? "2fr 1fr" : "1fr",
        gridTemplateRows: images.length >= 3 ? "1fr 1fr" : "auto",
        maxHeight: "480px",
      }}>
        <img
          src={images[0]}
          alt={`${nom} - photo 1`}
          className={cn(
            "w-full h-full object-cover cursor-pointer",
            images.length >= 3 && "row-span-2"
          )}
          style={{ maxHeight: "480px" }}
          onClick={() => setLightbox(0)}
        />
        {images.slice(1, 3).map((img, i) => (
          <img
            key={i}
            src={img}
            alt={`${nom} - photo ${i + 2}`}
            className="w-full h-full object-cover cursor-pointer"
            onClick={() => setLightbox(i + 1)}
          />
        ))}
        {images.length > 3 && (
          <button
            onClick={() => setLightbox(3)}
            className="absolute bottom-3 right-3 bg-card/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium shadow-soft"
          >
            +{images.length - 3} photos
          </button>
        )}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center">
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
          >
            <X size={28} />
          </button>
          <button
            onClick={() => setLightbox((lightbox - 1 + images.length) % images.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"
          >
            <ChevronLeft size={32} />
          </button>
          <img
            src={images[lightbox]}
            alt={`${nom} - photo ${lightbox + 1}`}
            className="max-h-[90vh] max-w-[90vw] object-contain"
          />
          <button
            onClick={() => setLightbox((lightbox + 1) % images.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"
          >
            <ChevronRight size={32} />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
            {lightbox + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
}
