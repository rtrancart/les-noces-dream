import { useState, useRef, useEffect, useMemo } from "react";
import { MapPin, ChevronDown, ChevronRight, Check, X } from "lucide-react";
import { REGIONS, DOM, PAYS_LIMITROPHES, getZoneLabel, getCondensedZoneNames } from "@/lib/zonesIntervention";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface LocationPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

export default function LocationPicker({ value, onChange, placeholder = "Où ?", className }: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const isMobile = useIsMobile();
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-focus list for immediate scroll
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
  };

  const toggleDept = (deptValue: string) => {
    onChange(
      value.includes(deptValue) ? value.filter((v) => v !== deptValue) : [...value, deptValue]
    );
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
      return;
    }
    toggleDept(val);
  };

  const selectedCount = (regionValue: string) => {
    const region = REGIONS.find((r) => r.value === regionValue);
    return region ? region.departements.filter((d) => value.includes(d.value)).length : 0;
  };

  // Display label
  const displayLabel = useMemo(() => {
    if (value.length === 0) return "";
    if (value.includes("france_entiere")) return "France entière";
    const labels = value.slice(0, 2).map((v) => getZoneLabel(v));
    if (value.length > 2) return `${labels.join(", ")} +${value.length - 2}`;
    return labels.join(", ");
  }, [value]);

  const listContent = (
    <div
      ref={listRef}
      tabIndex={0}
      className="h-[400px] max-h-[60vh] overflow-y-auto overscroll-contain outline-none"
      onWheelCapture={(e) => e.stopPropagation()}
      onTouchMoveCapture={(e) => e.stopPropagation()}
    >
      <div className="p-3 space-y-1">
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
              onChange([]);
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

  // Mobile: use Drawer
  if (isMobile) {
    return (
      <>
        <div onClick={() => setOpen(true)}>{triggerContent}</div>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="flex items-center justify-between">
              <DrawerTitle className="font-sans text-lg">Lieu</DrawerTitle>
              {value.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-sm text-primary font-sans hover:underline"
                >
                  Tout effacer
                </button>
              )}
            </DrawerHeader>
            {listContent}
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  // Desktop: use Popover
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
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-sans text-sm font-medium text-foreground">Sélectionner un lieu</span>
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-primary font-sans hover:underline"
            >
              Tout effacer
            </button>
          )}
        </div>
        {listContent}
      </PopoverContent>
    </Popover>
  );
}
