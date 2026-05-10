import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ZoneRefRow {
  type: "region" | "departement" | "dom" | "pays";
  slug: string;
  label: string;
  zone_value: string;
  parent_region_slug: string | null;
  parent_region_label: string | null;
  parent_region_zone_value: string | null;
  dept_code: string | null;
}

interface ZonesContextValue {
  /** Map slug → row, for synchronous lookup of admin zones */
  bySlug: Map<string, ZoneRefRow>;
  /** Map zone_value → row */
  byZoneValue: Map<string, ZoneRefRow>;
  loaded: boolean;
}

const ZonesContext = createContext<ZonesContextValue>({
  bySlug: new Map(),
  byZoneValue: new Map(),
  loaded: false,
});

export function ZonesProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<ZonesContextValue>({
    bySlug: new Map(),
    byZoneValue: new Map(),
    loaded: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("zones_reference")
        .select(
          "type, slug, label, zone_value, parent_region_slug, parent_region_label, parent_region_zone_value, dept_code"
        );
      if (cancelled) return;
      if (error || !data) {
        setValue((v) => ({ ...v, loaded: true }));
        return;
      }
      const bySlug = new Map<string, ZoneRefRow>();
      const byZoneValue = new Map<string, ZoneRefRow>();
      for (const row of data as ZoneRefRow[]) {
        bySlug.set(row.slug, row);
        byZoneValue.set(row.zone_value, row);
      }
      setValue({ bySlug, byZoneValue, loaded: true });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <ZonesContext.Provider value={value}>{children}</ZonesContext.Provider>;
}

export function useZones() {
  return useContext(ZonesContext);
}
