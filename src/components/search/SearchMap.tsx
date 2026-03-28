import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ProviderCardData } from "./ProviderCard";

interface SearchMapProps {
  providers: ProviderCardData[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}

const DEFAULT_CENTER: [number, number] = [46.603354, 1.888334]; // France center
const DEFAULT_ZOOM = 6;

const defaultIcon = L.divIcon({
  className: "",
  html: `<div style="width:24px;height:24px;background:hsl(var(--primary));border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const premiumIcon = L.divIcon({
  className: "",
  html: `<div style="width:28px;height:28px;background:hsl(var(--primary));border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;"><div style="width:8px;height:8px;background:white;border-radius:50%;"></div></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const hoveredIcon = L.divIcon({
  className: "",
  html: `<div style="width:32px;height:32px;background:hsl(var(--primary));border:3px solid white;border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,0.4);transform:scale(1.1);"></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

export default function SearchMap({ providers, hoveredId, onHover }: SearchMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    const bounds: [number, number][] = [];

    providers.forEach((p) => {
      const lat = (p as any).latitude;
      const lng = (p as any).longitude;
      if (lat == null || lng == null) return;

      const icon = p.est_premium ? premiumIcon : defaultIcon;
      const marker = L.marker([lat, lng], { icon })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:var(--font-sans);min-width:140px;">
            <strong style="font-size:13px;">${p.nom_commercial}</strong><br/>
            <span style="font-size:11px;color:#666;">${p.ville}${p.region ? `, ${p.region}` : ""}</span>
            ${p.note_moyenne ? `<br/><span style="font-size:11px;">⭐ ${p.note_moyenne.toFixed(1)}</span>` : ""}
          </div>`
        );

      marker.on("mouseover", () => onHover(p.id));
      marker.on("mouseout", () => onHover(null));

      markersRef.current.set(p.id, marker);
      bounds.push([lat, lng]);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
    }
  }, [providers, onHover]);

  // Handle hover highlight
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const provider = providers.find((p) => p.id === id);
      if (!provider) return;
      if (id === hoveredId) {
        marker.setIcon(hoveredIcon);
        marker.setZIndexOffset(1000);
      } else {
        marker.setIcon(provider.est_premium ? premiumIcon : defaultIcon);
        marker.setZIndexOffset(0);
      }
    });
  }, [hoveredId, providers]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-border">
      <div ref={mapRef} className="w-full h-full" />
      {/* Legend */}
      <div className="absolute bottom-4 left-4 right-4 bg-card/95 backdrop-blur-sm p-3 rounded-xl shadow-soft border border-border z-[1000]">
        <p className="font-sans font-semibold text-foreground text-sm mb-1.5">
          {providers.filter((p) => (p as any).latitude != null).length} prestataire{providers.filter((p) => (p as any).latitude != null).length > 1 ? "s" : ""} sur la carte
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 bg-primary rounded-full border-2 border-card shadow-sm" />
            <span className="font-sans text-xs text-foreground">Standard</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative w-3.5 h-3.5 bg-primary rounded-full border-2 border-card shadow-sm">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-card rounded-full" />
              </div>
            </div>
            <span className="font-sans text-xs text-foreground">Premium</span>
          </div>
        </div>
      </div>
    </div>
  );
}
