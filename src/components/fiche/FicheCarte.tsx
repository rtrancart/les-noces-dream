import { MapPin } from "lucide-react";

interface Props {
  latitude: number | null;
  longitude: number | null;
  ville: string;
  region: string;
}

export default function FicheCarte({ latitude, longitude, ville, region }: Props) {
  if (!latitude || !longitude) {
    return (
      <div className="bg-secondary/30 rounded-xl p-6 flex items-center gap-3">
        <MapPin size={20} className="text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {ville}, {region}
        </span>
      </div>
    );
  }

  const mapSrc = `https://www.google.com/maps?q=${latitude},${longitude}&z=13&output=embed`;

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden border border-border" style={{ height: 240 }}>
        <iframe
          src={mapSrc}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Localisation du prestataire"
        />
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin size={14} />
        <span>{ville}, {region}</span>
      </div>
    </div>
  );
}
