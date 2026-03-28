import type { ProviderCardData } from "./ProviderCard";

interface SearchMapProps {
  providers: ProviderCardData[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}

/** Simplified SVG map of France with provider dots */
export default function SearchMap({ providers, hoveredId, onHover }: SearchMapProps) {
  const regionPositions: Record<string, { x: number; y: number }> = {
    "Île-de-France": { x: 300, y: 180 },
    "Provence-Alpes-Côte d'Azur": { x: 420, y: 420 },
    "Auvergne-Rhône-Alpes": { x: 380, y: 320 },
    "Nouvelle-Aquitaine": { x: 200, y: 380 },
    "Occitanie": { x: 300, y: 480 },
    "Bretagne": { x: 120, y: 240 },
    "Normandie": { x: 200, y: 140 },
    "Grand Est": { x: 420, y: 200 },
    "Hauts-de-France": { x: 280, y: 80 },
    "Pays de la Loire": { x: 180, y: 280 },
    "Bourgogne-Franche-Comté": { x: 360, y: 240 },
    "Centre-Val de Loire": { x: 260, y: 260 },
    "Corse": { x: 470, y: 500 },
  };

  return (
    <div className="relative w-full h-full bg-secondary/20 rounded-xl overflow-hidden">
      <svg viewBox="0 0 520 580" className="w-full h-full">
        {/* France outline */}
        <path
          d="M250,20 L420,120 L450,280 L420,440 L320,550 L180,550 L80,440 L50,280 L80,120 Z"
          fill="hsl(var(--card))"
          stroke="hsl(var(--muted))"
          strokeWidth="3"
        />
        <line x1="250" y1="20" x2="250" y2="300" stroke="hsl(var(--secondary))" strokeWidth="1" opacity="0.3" />
        <line x1="80" y1="120" x2="420" y2="440" stroke="hsl(var(--secondary))" strokeWidth="1" opacity="0.3" />
        <line x1="420" y1="120" x2="80" y2="440" stroke="hsl(var(--secondary))" strokeWidth="1" opacity="0.3" />

        {providers.map((p) => {
          const pos = regionPositions[p.region] ?? { x: 300, y: 300 };
          const isHovered = hoveredId === p.id;
          return (
            <g key={p.id}>
              {isHovered && (
                <circle cx={pos.x} cy={pos.y} r="20" fill="hsl(var(--primary))" opacity="0.3" className="animate-ping" />
              )}
              <circle
                cx={pos.x} cy={pos.y}
                r={isHovered ? 14 : 10}
                fill={isHovered ? "hsl(var(--primary) / 0.8)" : "hsl(var(--primary))"}
                stroke="white" strokeWidth="3"
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => onHover(p.id)}
                onMouseLeave={() => onHover(null)}
              />
              {p.est_premium && (
                <circle cx={pos.x} cy={pos.y} r="4" fill="white" className="pointer-events-none" />
              )}
              {isHovered && (
                <g>
                  <rect x={pos.x - 70} y={pos.y - 55} width="140" height="36" fill="white" stroke="hsl(var(--primary))" strokeWidth="1.5" rx="8" />
                  <text x={pos.x} y={pos.y - 38} textAnchor="middle" fontSize="11" fill="hsl(var(--foreground))" fontWeight="600" fontFamily="Montserrat">
                    {p.nom_commercial.length > 18 ? p.nom_commercial.substring(0, 18) + "…" : p.nom_commercial}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 right-4 bg-card/95 backdrop-blur-sm p-4 rounded-xl shadow-soft border border-border">
        <p className="font-sans font-semibold text-foreground text-sm mb-2">
          {providers.length} prestataire{providers.length > 1 ? "s" : ""}
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
