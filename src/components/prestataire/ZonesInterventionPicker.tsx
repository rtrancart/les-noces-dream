import { useState, useMemo, useCallback } from "react";
import { REGIONS, DOM, PAYS_LIMITROPHES, getCondensedZoneNames } from "@/lib/zonesIntervention";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronRight, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string[];
  onChange: (zones: string[]) => void;
}

export default function ZonesInterventionPicker({ value, onChange }: Props) {
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());

  const franceEntiere = value.includes("france_entiere");

  const toggleFranceEntiere = useCallback(() => {
    if (franceEntiere) {
      onChange([]);
    } else {
      onChange(["france_entiere"]);
    }
  }, [franceEntiere, onChange]);

  const toggleRegion = useCallback(
    (regionValue: string) => {
      const region = REGIONS.find((r) => r.value === regionValue);
      if (!region) return;
      const deptValues = region.departements.map((d) => d.value);
      const allSelected = deptValues.every((d) => value.includes(d));

      let next: string[];
      if (allSelected) {
        next = value.filter((v) => !deptValues.includes(v) && v !== "france_entiere");
      } else {
        const set = new Set(value.filter((v) => v !== "france_entiere"));
        deptValues.forEach((d) => set.add(d));
        next = [...set];
      }
      onChange(next);
    },
    [value, onChange]
  );

  const toggleDept = useCallback(
    (dept: string) => {
      let next: string[];
      if (value.includes(dept)) {
        next = value.filter((v) => v !== dept && v !== "france_entiere");
      } else {
        next = [...value.filter((v) => v !== "france_entiere"), dept];
      }
      onChange(next);
    },
    [value, onChange]
  );

  const toggleExtra = useCallback(
    (val: string) => {
      let next: string[];
      if (value.includes(val)) {
        next = value.filter((v) => v !== val);
      } else {
        next = [...value.filter((v) => v !== "france_entiere"), val];
      }
      onChange(next);
    },
    [value, onChange]
  );

  const toggleExpand = (regionValue: string) => {
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      next.has(regionValue) ? next.delete(regionValue) : next.add(regionValue);
      return next;
    });
  };

  const condensedNames = useMemo(() => getCondensedZoneNames(value), [value]);

  const removeZone = (zone: string) => {
    // Find what to remove — could be a region (remove all its depts) or a single value
    const region = REGIONS.find((r) => r.label === zone);
    if (region) {
      const deptValues = region.departements.map((d) => d.value);
      onChange(value.filter((v) => !deptValues.includes(v) && v !== "france_entiere"));
    } else {
      // Find value by label
      const allEntries = [
        ...REGIONS.flatMap((r) => r.departements),
        ...DOM,
        ...PAYS_LIMITROPHES,
      ];
      const entry = allEntries.find((e) => e.label === zone);
      if (entry) {
        onChange(value.filter((v) => v !== entry.value && v !== "france_entiere"));
      } else if (zone === "France entière") {
        onChange([]);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Selected zones summary */}
      {condensedNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {condensedNames.map((name) => (
            <Badge
              key={name}
              variant="secondary"
              className="gap-1 pl-2 pr-1 py-1 font-sans text-xs"
            >
              {name}
              <button
                type="button"
                onClick={() => removeZone(name)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Picker */}
      <div className="border border-border rounded-lg max-h-[360px] overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
        {/* France entière */}
        <label className="flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-accent/50 cursor-pointer transition-colors">
          <Checkbox
            checked={franceEntiere}
            onCheckedChange={toggleFranceEntiere}
          />
          <MapPin className="h-4 w-4 text-primary" />
          <span className="font-sans text-sm font-medium text-foreground">France entière</span>
        </label>

        {/* Regions */}
        {REGIONS.map((region) => {
          const deptValues = region.departements.map((d) => d.value);
          const selectedCount = deptValues.filter((d) => value.includes(d)).length;
          const allSelected = selectedCount === deptValues.length;
          const someSelected = selectedCount > 0 && !allSelected;
          const expanded = expandedRegions.has(region.value);

          return (
            <div key={region.value} className="border-b border-border last:border-b-0">
              <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-accent/50 transition-colors">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={() => toggleRegion(region.value)}
                  disabled={franceEntiere}
                />
                <button
                  type="button"
                  onClick={() => toggleExpand(region.value)}
                  className="flex-1 flex items-center gap-2 text-left"
                >
                  <span className="font-sans text-sm text-foreground">{region.label}</span>
                  {someSelected && (
                    <span className="font-sans text-[10px] text-muted-foreground">
                      {selectedCount}/{deptValues.length}
                    </span>
                  )}
                  <span className="ml-auto">
                    {expanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </span>
                </button>
              </div>

              {expanded && (
                <div className="pl-10 pr-4 pb-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {region.departements.map((dept) => (
                    <label
                      key={dept.value}
                      className="flex items-center gap-2 py-1 cursor-pointer"
                    >
                      <Checkbox
                        checked={franceEntiere || value.includes(dept.value)}
                        onCheckedChange={() => toggleDept(dept.value)}
                        disabled={franceEntiere}
                      />
                      <span className="font-sans text-xs text-muted-foreground">
                        {dept.value} – {dept.label}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* DOM */}
        <div className="border-t border-border">
          <p className="px-4 pt-3 pb-1 font-sans text-[10px] uppercase tracking-widest text-muted-foreground">
            Outre-mer
          </p>
          <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {DOM.map((d) => (
              <label key={d.value} className="flex items-center gap-2 py-1 cursor-pointer">
                <Checkbox
                  checked={franceEntiere || value.includes(d.value)}
                  onCheckedChange={() => toggleExtra(d.value)}
                  disabled={franceEntiere}
                />
                <span className="font-sans text-xs text-muted-foreground">
                  {d.value} – {d.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Pays limitrophes */}
        <div className="border-t border-border">
          <p className="px-4 pt-3 pb-1 font-sans text-[10px] uppercase tracking-widest text-muted-foreground">
            Pays limitrophes
          </p>
          <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {PAYS_LIMITROPHES.map((p) => (
              <label key={p.value} className="flex items-center gap-2 py-1 cursor-pointer">
                <Checkbox
                  checked={value.includes(p.value)}
                  onCheckedChange={() => toggleExtra(p.value)}
                  disabled={franceEntiere}
                />
                <span className="font-sans text-xs text-muted-foreground">{p.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
