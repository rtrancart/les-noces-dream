import { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, ChevronRight, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  value: string;          // slug of selected category (parent or child)
  onChange: (slug: string) => void;
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

  const selectCategory = (slug: string) => {
    onChange(slug);
    setOpen(false);
  };

  // Find selected label
  const selectedLabel = useMemo(() => {
    if (!value) return "";
    for (const cat of categories) {
      if (cat.slug === value) return cat.nom;
      if (cat.children) {
        const child = cat.children.find((c) => c.slug === value);
        if (child) return child.nom;
      }
    }
    return "";
  }, [value, categories]);

  // Find selected icon
  const selectedIcon = useMemo(() => {
    if (!value) return null;
    for (const cat of categories) {
      if (cat.slug === value) return cat.icone_url;
      if (cat.children) {
        const child = cat.children.find((c) => c.slug === value);
        if (child) return child.icone_url || cat.icone_url;
      }
    }
    return null;
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
        {/* Option "Toutes les catégories" */}
        <button
          type="button"
          onClick={() => selectCategory("")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
            !value ? "bg-primary/10 text-primary" : "hover:bg-secondary/50 text-foreground"
          )}
        >
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="font-sans text-sm font-medium">Toutes les catégories</span>
        </button>

        <div className="h-px bg-border my-2" />

        {categories.map((parent) => {
          const expanded = expandedParents.has(parent.id);
          const hasChildren = parent.children && parent.children.length > 0;
          const isParentSelected = value === parent.slug;
          const isChildSelected = parent.children?.some((c) => c.slug === value) ?? false;

          return (
            <div key={parent.id}>
              <div className="flex items-center gap-1">
                {/* Parent button */}
                <button
                  type="button"
                  onClick={() => selectCategory(parent.slug)}
                  className={cn(
                    "flex-1 flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
                    isParentSelected
                      ? "bg-primary/10 text-primary"
                      : isChildSelected
                        ? "text-primary"
                        : "hover:bg-secondary/50 text-foreground"
                  )}
                >
                  {parent.icone_url ? (
                    <img
                      src={parent.icone_url}
                      alt=""
                      className="w-5 h-5 object-contain shrink-0"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded bg-secondary shrink-0" />
                  )}
                  <span className="font-sans text-sm font-medium">{parent.nom}</span>
                </button>

                {/* Expand toggle */}
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

              {/* Children */}
              {hasChildren && expanded && (
                <div className="ml-6 space-y-0.5 pb-1">
                  {parent.children!.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => selectCategory(child.slug)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors",
                        value === child.slug
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-secondary/50 text-foreground"
                      )}
                    >
                      {child.icone_url ? (
                        <img
                          src={child.icone_url}
                          alt=""
                          className="w-4 h-4 object-contain shrink-0"
                        />
                      ) : parent.icone_url ? (
                        <img
                          src={parent.icone_url}
                          alt=""
                          className="w-4 h-4 object-contain shrink-0 opacity-50"
                        />
                      ) : (
                        <div className="w-4 h-4 rounded bg-secondary/50 shrink-0" />
                      )}
                      <span className="text-sm font-sans">{child.nom}</span>
                    </button>
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
      {selectedLabel ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectedIcon && (
            <img src={selectedIcon} alt="" className="w-5 h-5 object-contain shrink-0" />
          )}
          <span className="text-base text-foreground font-sans truncate">{selectedLabel}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
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
        <div className="px-4 py-3 border-b border-border">
          <span className="font-serif text-sm font-medium text-foreground">
            Choisir une catégorie
          </span>
        </div>
        {listContent}
      </PopoverContent>
    </Popover>
  );
}
