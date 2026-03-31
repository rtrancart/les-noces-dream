import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";

interface AddressSuggestion {
  label: string;
  housenumber?: string;
  street?: string;
  postcode?: string;
  city?: string;
  context?: string; // "dept, region"
  x: number; // longitude
  y: number; // latitude
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, details?: {
    ville?: string;
    code_postal?: string;
    region?: string;
    latitude?: number;
    longitude?: number;
  }) => void;
  placeholder?: string;
}

export default function AddressAutocomplete({ value, onChange, placeholder }: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`
      );
      const data = await res.json();
      const results: AddressSuggestion[] = (data.features ?? []).map((f: any) => ({
        label: f.properties.label,
        housenumber: f.properties.housenumber,
        street: f.properties.street,
        postcode: f.properties.postcode,
        city: f.properties.city,
        context: f.properties.context,
        x: f.geometry.coordinates[0],
        y: f.geometry.coordinates[1],
      }));
      setSuggestions(results);
      setOpen(results.length > 0);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    onChange(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const select = (s: AddressSuggestion) => {
    setQuery(s.label);
    setOpen(false);
    // Extract region from context (format: "dept, region")
    const parts = s.context?.split(", ") ?? [];
    const region = parts.length >= 2 ? parts[parts.length - 1] : "";
    onChange(s.label, {
      ville: s.city,
      code_postal: s.postcode,
      region,
      latitude: s.y,
      longitude: s.x,
    });
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        placeholder={placeholder ?? "Rechercher une adresse…"}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-accent text-sm font-sans text-foreground transition-colors"
              onClick={() => select(s)}
            >
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
