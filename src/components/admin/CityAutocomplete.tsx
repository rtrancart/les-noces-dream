import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";
import { REGIONS } from "@/lib/regions";

interface CitySuggestion {
  /** Nom de la commune */
  city: string;
  postcode?: string;
  /** "dept_code, departement, region" */
  context?: string;
  x: number; // longitude
  y: number; // latitude
}

export interface CityDetails {
  ville: string;
  code_postal?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
}

interface CityAutocompleteProps {
  value: string;
  onChange: (ville: string, details?: CityDetails) => void;
  placeholder?: string;
}

/** Normalise le libellé de région renvoyé par l'API vers le nom officiel utilisé en base. */
function normaliserRegion(brut: string | undefined): string | undefined {
  if (!brut) return undefined;
  const cible = brut.trim().toLowerCase();
  const match = REGIONS.find((r) => r.nom.toLowerCase() === cible);
  return match?.nom;
}

export default function CityAutocomplete({ value, onChange, placeholder }: CityAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    try {
      const res = await fetch(
        `https://api-adresse.data.gouv.fr/search/?type=municipality&limit=7&q=${encodeURIComponent(q)}`,
      );
      const data = await res.json();
      const results: CitySuggestion[] = (data.features ?? []).map((f: {
        properties: { city?: string; name?: string; postcode?: string; context?: string };
        geometry: { coordinates: [number, number] };
      }) => ({
        city: f.properties.city ?? f.properties.name ?? "",
        postcode: f.properties.postcode,
        context: f.properties.context,
        x: f.geometry.coordinates[0],
        y: f.geometry.coordinates[1],
      })).filter((s: CitySuggestion) => s.city);
      setSuggestions(results);
      setOpen(results.length > 0);
    } catch {
      setSuggestions([]);
      setOpen(false);
    }
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    onChange(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const select = (s: CitySuggestion) => {
    setQuery(s.city);
    setOpen(false);
    const parts = s.context?.split(",").map((p) => p.trim()) ?? [];
    const region = normaliserRegion(parts[parts.length - 1]);
    onChange(s.city, {
      ville: s.city,
      code_postal: s.postcode,
      region,
      latitude: s.y,
      longitude: s.x,
    });
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder ?? "Rechercher une commune…"}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={`${s.city}-${s.postcode}-${i}`}
              type="button"
              className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-accent text-sm font-sans text-foreground transition-colors"
              onClick={() => select(s)}
            >
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{s.city}</span>
              <span className="ml-auto text-xs text-muted-foreground shrink-0">
                {[s.postcode, s.context?.split(",")[1]?.trim()].filter(Boolean).join(" · ")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
