import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { MapPin, ChevronDown, ChevronRight, X, Search, Navigation, Check } from "lucide-react";
import { REGIONS, DOM, PAYS_LIMITROPHES, getCondensedZoneNames } from "@/lib/zonesIntervention";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export interface CitySearchData {
  lat: number;
  lng: number;
  label: string;
  radius: number; // km
}

interface LocationPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
  citySearch?: CitySearchData | null;
  onCitySearchChange?: (city: CitySearchData | null) => void;
  placeholder?: string;
  className?: string;
}

const RADIUS_OPTIONS = [10, 20, 30, 50, 100];

interface AddressSuggestion {
  label: string;
  city: string;
  postcode: string;
  context: string;
  lat: number;
  lng: number;
}

function useAddressSearch() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&type=municipality&limit=6`
        );
        const data = await res.json();
        setSuggestions(
          (data.features ?? []).map((f: any) => ({
            label: f.properties.label,
            city: f.properties.city || f.properties.name,
            postcode: f.properties.postcode,
            context: f.properties.context,
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
          }))
        );
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  return { query, setQuery, search, suggestions, setSuggestions, loading };
}

export default function LocationPicker({
  value,
  onChange,
  citySearch,
  onCitySearchChange,
  placeholder = "Où ?",
  className,
}: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const isMobile = useIsMobile();
  const listRef = useRef<HTMLDivElement>(null);
  const { query, setQuery, search, suggestions, setSuggestions, loading } = useAddressSearch();

  useEffect(() => {
    if (open && listRef.current) {
      requestAnimationFrame(() => listRef.current?.focus());
    }
  }, [open]);

  const toggleRegionExpand = (regionValue: string) => {
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      next.has(regionValue) ? next.delete(regionValue) : next.add(regionValue);
      return next;
    });
  };

  const isRegionFullySelected = (regionValue: string) => {
    const region = REGIONS.find((r) => r.value === regionValue);
    return region ? region.departements.every((d) => value.includes(d.value)) : false;
  };

  const isRegionPartiallySelected = (regionValue: string) => {
    const region = REGIONS.find((r) => r.value === regionValue);
    if (!region) return false;
    const count = region.departements.filter((d) => value.includes(d.value)).length;
    return count > 0 && count < region.departements.length;
  };

  const toggleRegion = (regionValue: string) => {
    const region = REGIONS.find((r) => r.value === regionValue);
    if (!region) return;
    const deptValues = region.departements.map((d) => d.value);
    if (isRegionFullySelected(regionValue)) {
      onChange(value.filter((v) => !deptValues.includes(v)));
    } else {
      onChange([...new Set([...value, ...deptValues])]);
    }
    // Clear city search when using zones
    onCitySearchChange?.(null);
  };

  const toggleDept = (deptValue: string) => {
    onChange(
      value.includes(deptValue) ? value.filter((v) => v !== deptValue) : [...value, deptValue]
    );
    onCitySearchChange?.(null);
  };

  const toggleSpecial = (val: string) => {
    if (val === "france_entiere") {
      if (value.includes("france_entiere")) {
        onChange([]);
      } else {
        const allDepts = REGIONS.flatMap((r) => r.departements.map((d) => d.value));
        const allDom = DOM.map((d) => d.value);
        onChange(["france_entiere", ...allDepts, ...allDom]);
      }
      onCitySearchChange?.(null);
      return;
    }
    toggleDept(val);
  };

  const selectedCount = (regionValue: string) => {
    const region = REGIONS.find((r) => r.value === regionValue);
    return region ? region.departements.filter((d) => value.includes(d.value)).length : 0;
  };

  const handleSelectCity = (s: AddressSuggestion) => {
    onCitySearchChange?.({ lat: s.lat, lng: s.lng, label: s.label, radius: 30 });
    onChange([]); // Clear zone selection
    setSuggestions([]);
    setQuery("");
  };

  const handleRadiusChange = (radius: number) => {
    if (citySearch) {
      onCitySearchChange?.({ ...citySearch, radius });
    }
  };

  const handleClearAll = () => {
    onChange([]);
    onCitySearchChange?.(null);
    setQuery("");
    setSuggestions([]);
  };

  // Display label
  const displayLabel = useMemo(() => {
    if (citySearch) {
      return `${citySearch.label} — ${citySearch.radius} km`;
    }
    if (value.length === 0) return "";
    const condensed = getCondensedZoneNames(value);
    if (condensed.length > 2) return `${condensed.slice(0, 2).join(", ")} +${condensed.length - 2}`;
    return condensed.join(", ");
  }, [value, citySearch]);

  const hasSelection = value.length > 0 || !!citySearch;

  const listContent = (
    <div
      ref={listRef}
      tabIndex={0}
      className="h-[400px] max-h-[60vh] overflow-y-auto overscroll-contain outline-none"
      onWheelCapture={(e) => e.stopPropagation()}
      onTouchMoveCapture={(e) => e.stopPropagation()}
    >
      <div className="p-3 space-y-1">
        {/* City search input */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="Rechercher une ville..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background text-sm font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* City search results */}
        {suggestions.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden mb-2">
            {suggestions.map((s, i) => (
              <button
                key={`${s.lat}-${s.lng}-${i}`}
                onClick={() => handleSelectCity(s)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/50 transition-colors text-left"
              >
                <Navigation className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="font-sans text-sm text-foreground truncate">{s.city}</p>
                  <p className="font-sans text-xs text-muted-foreground truncate">{s.context}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="font-sans text-sm">Recherche...</span>
          </div>
        )}

        {/* Active city search: show radius selector */}
        {citySearch && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                <span className="font-sans text-sm font-medium text-foreground truncate">{citySearch.label}</span>
              </div>
              <button
                onClick={() => {
                  onCitySearchChange?.(null);
                  setQuery("");
                }}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-sans text-xs text-muted-foreground">Rayon :</span>
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => handleRadiusChange(r)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-sans font-medium transition-all",
                    citySearch.radius === r
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground hover:bg-secondary/80"
                  )}
                >
                  {r} km
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Divider between city search and zone picker */}
        {!citySearch && (
          <>
            <div className="flex items-center gap-3 my-2">
              <div className="h-px bg-border flex-1" />
              <span className="font-sans text-xs text-muted-foreground uppercase tracking-wider">ou parcourir</span>
              <div className="h-px bg-border flex-1" />
            </div>

            {/* France entière */}
            <label className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary/50 cursor-pointer transition-colors">
              <Checkbox
                checked={value.includes("france_entiere")}
                onCheckedChange={() => toggleSpecial("france_entiere")}
              />
              <span className="font-sans font-medium text-sm text-foreground">France entière</span>
            </label>

            <div className="h-px bg-border my-2" />

            {/* Régions */}
            {REGIONS.map((region) => {
              const expanded = expandedRegions.has(region.value);
              const full = isRegionFullySelected(region.value);
              const partial = isRegionPartiallySelected(region.value);
              const count = selectedCount(region.value);

              return (
                <div key={region.value}>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-3 flex-1 px-3 py-2.5 rounded-md hover:bg-secondary/50 cursor-pointer transition-colors">
                      <Checkbox
                        checked={full}
                        // @ts-ignore
                        indeterminate={partial}
                        onCheckedChange={() => toggleRegion(region.value)}
                      />
                      <span className="font-sans text-sm text-foreground font-medium">{region.label}</span>
                      {partial && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          {count}/{region.departements.length}
                        </span>
                      )}
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleRegionExpand(region.value)}
                      className="p-2 rounded-md hover:bg-secondary/50 text-muted-foreground transition-colors"
                    >
                      {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>

                  {expanded && (
                    <div className="ml-8 space-y-0.5 pb-1">
                      {region.departements.map((dept) => (
                        <label
                          key={dept.value}
                          className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary/50 cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={value.includes(dept.value)}
                            onCheckedChange={() => toggleDept(dept.value)}
                          />
                          <span className="text-sm text-foreground font-sans">
                            <span className="text-muted-foreground">{dept.value}</span> — {dept.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="h-px bg-border my-2" />

            {/* DOM */}
            <p className="px-3 py-1 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wider">DOM</p>
            {DOM.map((d) => (
              <label key={d.value} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary/50 cursor-pointer transition-colors">
                <Checkbox checked={value.includes(d.value)} onCheckedChange={() => toggleDept(d.value)} />
                <span className="text-sm font-medium text-foreground font-sans">{d.label}</span>
              </label>
            ))}

            <div className="h-px bg-border my-2" />

            {/* Pays limitrophes */}
            <p className="px-3 py-1 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wider">Pays limitrophes</p>
            {PAYS_LIMITROPHES.map((d) => (
              <label key={d.value} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary/50 cursor-pointer transition-colors">
                <Checkbox checked={value.includes(d.value)} onCheckedChange={() => toggleDept(d.value)} />
                <span className="text-sm font-medium text-foreground font-sans">{d.label}</span>
              </label>
            ))}
          </>
        )}
      </div>
    </div>
  );

  const triggerContent = (
    <div className={cn("flex items-center gap-3 flex-1 cursor-pointer min-w-0", className)}>
      <MapPin className="w-5 h-5 text-muted-foreground shrink-0" />
      {displayLabel ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-base text-foreground font-sans truncate">{displayLabel}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClearAll();
            }}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <span className="text-base text-muted-foreground font-sans">{placeholder}</span>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div onClick={() => setOpen(true)}>{triggerContent}</div>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="flex items-center justify-between">
              <DrawerTitle className="font-sans text-lg">Lieu</DrawerTitle>
              {hasSelection && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-sm text-primary font-sans hover:underline"
                >
                  Tout effacer
                </button>
              )}
            </DrawerHeader>
            {listContent}
            <div className="p-3 border-t border-border">
              <Button onClick={() => setOpen(false)} className="w-full">
                <Check className="w-4 h-4 mr-2" />
                Valider
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {triggerContent}
      </PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-0 shadow-elevated border-border"
        align="start"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-sans text-sm font-medium text-foreground">Sélectionner un lieu</span>
          {hasSelection && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-primary font-sans hover:underline"
            >
              Tout effacer
            </button>
          )}
        </div>
        {listContent}
        <div className="p-3 border-t border-border">
          <Button onClick={() => setOpen(false)} className="w-full">
            <Check className="w-4 h-4 mr-2" />
            Valider
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
