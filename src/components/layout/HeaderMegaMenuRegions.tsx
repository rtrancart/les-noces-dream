import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { useHeaderRegions } from "@/hooks/useHeaderCategories";

interface Props {
  onNavigate: () => void;
}

export default function HeaderMegaMenuRegions({ onNavigate }: Props) {
  const { data: regions, isLoading } = useHeaderRegions();

  return (
    <div className="absolute left-0 right-0 top-full bg-[hsl(var(--header-ivoire))] shadow-[var(--shadow-header-mega)] border-t border-[hsl(var(--header-or-fonce)/0.15)] z-40 animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="max-w-[1320px] mx-auto px-8 py-8">
        <h4 className="flex items-center gap-3 text-[10.5px] font-sans font-semibold uppercase tracking-[0.2em] text-[hsl(var(--header-or-fonce))] mb-5">
          <span>Mariage par région</span>
          <span className="flex-1 h-px bg-gradient-to-r from-[hsl(var(--header-or-fonce)/0.3)] to-transparent" />
        </h4>
        {isLoading || !regions ? (
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 bg-[hsl(var(--header-or-fonce)/0.08)] rounded animate-pulse" />
            ))}
          </div>
        ) : regions.length === 0 ? (
          <p className="font-sans text-sm text-muted-foreground">Aucune région publiée.</p>
        ) : (
          <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2">
            {regions.map((r) => (
              <li key={r.slug_region}>
                <Link
                  to={`/mariage/${r.slug_region}`}
                  onClick={onNavigate}
                  className="flex items-center gap-2 py-1.5 font-sans text-sm text-foreground/85 hover:text-[hsl(var(--header-or-fonce))] transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 text-[hsl(var(--header-or-fonce)/0.6)]" />
                  {r.nom_region}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
