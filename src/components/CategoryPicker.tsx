import { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, ChevronRight, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export interface CategoryOption {
  id: string;
  nom: string;
  slug: string;
  icone_url: string | null;
  children?: CategoryOption[];
}

interface CategoryPickerProps {
  categories: CategoryOption[];
  value: string[];
  onChange: (slugs: string[]) => void;
  placeholder?: string;
  className?: string;
}

export default function CategoryPicker({
  categories,
  value,
  onChange,
  placeholder = "Quelle catégorie ?",
  className,
}: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const isMobile = useIsMobile();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && listRef.current) {
      requestAnimationFrame(() => listRef.current?.focus());
    }
  }, [open]);

  const toggleExpand = (id: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Toggle a parent: selects/deselects parent + all children
  const toggleParent = (parent: CategoryOption) => {
    const allSlugs = [parent.slug, ...(parent.children?.map((c) => c.slug) ?? [])];
    const allSelected = allSlugs.every((s) => value.includes(s));
    if (allSelected) {
      onChange(value.filter((v) => !allSlugs.includes(v)));
    } else {
      onChange([...new Set([...value, ...allSlugs])]);
    }
  };

  // Toggle a single child
  const toggleChild = (slug: string) => {
    onChange(
      value.includes(slug) ? value.filter((v) => v !== slug) : [...value, slug]
    );
  };

  const isParentFullySelected = (parent: CategoryOption) => {
    const allSlugs = [parent.slug, ...(parent.children?.map((c) => c.slug) ?? [])];
    return allSlugs.every((s) => value.includes(s));
  };

  const isParentPartiallySelected = (parent: CategoryOption) => {
    const allSlugs = [parent.slug, ...(parent.children?.map((c) => c.slug) ?? [])];
    const count = allSlugs.filter((s) => value.includes(s)).length;
    return count > 0 && count < allSlugs.length;
  };

  const parentSelectedCount = (parent: CategoryOption) => {
    const childSlugs = parent.children?.map((c) => c.slug) ?? [];
    return childSlugs.filter((s) => value.includes(s)).length;
  };

  // Display label
  const displayLabel = useMemo(() => {
    if (value.length === 0) return "";
    // Find names for selected slugs
    const nameMap = new Map<string, string>();
    for (const cat of categories) {
      nameMap.set(cat.slug, cat.nom);
      cat.children?.forEach((c) => nameMap.set(c.slug, c.nom));
    }
    const names = value.slice(0, 2).map((s) => nameMap.get(s) ?? s);
    if (value.length > 2) return `${names.join(", ")} +${value.length - 2}`;
    return names.join(", ");
  }, [value, categories]);

  const listContent = (
    <div
      ref={listRef}
      tabIndex={0}
      className="h-[400px] max-h-[60vh] overflow-y-auto overscroll-contain outline-none"
      onWheelCapture={(e) => e.stopPropagation()}
      onTouchMoveCapture={(e) => e.stopPropagation()}
    >
      <div className="p-3 space-y-0.5">
        {categories.map((parent) => {
          const expanded = expandedParents.has(parent.id);
          const hasChildren = parent.children && parent.children.length > 0;
          const full = isParentFullySelected(parent);
          const partial = isParentPartiallySelected(parent);
          const count = parentSelectedCount(parent);

          return (
            <div key={parent.id}>
              <div className="flex items-center gap-1">
                <label className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary/50 cursor-pointer transition-colors">
                  <Checkbox
                    checked={full}
                    onCheckedChange={() => toggleParent(parent)}
                  />
                  <span className="font-sans text-sm font-medium text-foreground">{parent.nom}</span>
                  {hasChildren && partial && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {count}/{parent.children!.length}
                    </span>
                  )}
                </label>

                {hasChildren && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(parent.id)}
                    className="p-2 rounded-md hover:bg-secondary/50 text-muted-foreground transition-colors shrink-0"
                  >
                    {expanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>

              {hasChildren && expanded && (
                <div className="ml-8 space-y-0.5 pb-1">
                  {parent.children!.map((child) => (
                    <label
                      key={child.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={value.includes(child.slug)}
                        onCheckedChange={() => toggleChild(child.slug)}
                      />
                      <span className="text-sm font-sans text-foreground">{child.nom}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const triggerContent = (
    <div className={cn("flex items-center gap-3 flex-1 cursor-pointer min-w-0", className)}>
      <Search className="w-5 h-5 text-muted-foreground shrink-0" />
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

  if (isMobile) {
    return (
      <>
        <div onClick={() => setOpen(true)}>{triggerContent}</div>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="flex items-center justify-between">
              <DrawerTitle className="font-serif text-lg">Catégorie</DrawerTitle>
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{triggerContent}</PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-0 shadow-elevated border-border"
        align="start"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-sans text-sm font-medium text-foreground">
            Choisir une catégorie
          </span>
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
