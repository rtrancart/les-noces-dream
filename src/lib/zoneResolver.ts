import type { ZoneRefRow } from "@/contexts/ZonesContext";

/* ──────────────── Types ──────────────── */

export type ZoneType = "region" | "departement" | "ville";

export interface ResolvedZone {
  type: ZoneType;
  slug: string;
  label: string;
  /** Value used in prestataires.zones_intervention array */
  zoneValue?: string;
  /** Region label as stored in prestataires.region */
  regionLabel?: string;
  /** Region zone value (for ville → fallback match on zones_intervention) */
  regionZoneValue?: string;
  /** For ville only */
  lat?: number;
  lng?: number;
  /** Département code (e.g. "75") */
  deptCode?: string;
}

/* ──────────────── Slugify ──────────────── */

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ──────────────── Cache villes (in-memory, persists across navigations) ──────────────── */

const VILLE_CACHE = new Map<string, ResolvedZone | null>();

/* INSEE region codes → region label */
const INSEE_REGION_TO_LABEL: Record<string, string> = {
  "11": "Île-de-France",
  "24": "Centre-Val de Loire",
  "27": "Bourgogne-Franche-Comté",
  "28": "Normandie",
  "32": "Hauts-de-France",
  "44": "Grand Est",
  "52": "Pays de la Loire",
  "53": "Bretagne",
  "75": "Nouvelle-Aquitaine",
  "76": "Occitanie",
  "84": "Auvergne-Rhône-Alpes",
  "93": "Provence-Alpes-Côte d'Azur",
  "94": "Corse",
};

/* ──────────────── API ──────────────── */

/**
 * Resolve a URL slug into a zone definition.
 *
 * @param slug      The URL slug (e.g. "paris", "ile-de-france", "lyon")
 * @param zoneIndex The preloaded zones_reference cache (slug → row)
 *                  Pass `useZones().bySlug` from a React component.
 *
 * Lookup order:
 *  1. Cached admin zone (région / département / DOM / pays)
 *  2. In-memory ville cache
 *  3. geo.api.gouv.fr (network fallback, only for villes)
 */
export async function resolveZoneSlug(
  slug: string,
  zoneIndex: Map<string, ZoneRefRow>
): Promise<ResolvedZone | null> {
  if (!slug) return null;

  // 1. Admin zone (region / departement / dom / pays)
  const row = zoneIndex.get(slug);
  if (row) {
    if (row.type === "region") {
      return {
        type: "region",
        slug: row.slug,
        label: row.label,
        zoneValue: row.zone_value,
        regionLabel: row.label,
        regionZoneValue: row.zone_value,
      };
    }
    if (row.type === "departement") {
      return {
        type: "departement",
        slug: row.slug,
        label: row.label,
        zoneValue: row.zone_value,
        regionLabel: row.parent_region_label ?? undefined,
        regionZoneValue: row.parent_region_zone_value ?? undefined,
        deptCode: row.dept_code ?? row.zone_value,
      };
    }
    // dom / pays → treat as a region-like zone
    return {
      type: "region",
      slug: row.slug,
      label: row.label,
      zoneValue: row.zone_value,
      regionLabel: row.label,
      regionZoneValue: row.zone_value,
    };
  }

  // 2. Ville cache
  if (VILLE_CACHE.has(slug)) return VILLE_CACHE.get(slug) ?? null;

  // 3. Network fallback — geo.api.gouv.fr
  try {
    const nom = slug.replace(/-/g, " ");
    const url = `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(nom)}&boost=population&limit=5&fields=nom,code,centre,codeRegion,codeDepartement&format=json`;
    const res = await fetch(url);
    const list = (await res.json()) as Array<any>;
    const exact = list.find((c) => slugify(c.nom) === slug) ?? list[0];
    if (!exact || !exact.centre?.coordinates) {
      VILLE_CACHE.set(slug, null);
      return null;
    }
    const [lng, lat] = exact.centre.coordinates;
    const regionLabel = INSEE_REGION_TO_LABEL[exact.codeRegion];
    const regionRow = regionLabel ? zoneIndex.get(slugify(regionLabel)) : undefined;
    const resolved: ResolvedZone = {
      type: "ville",
      slug,
      label: exact.nom,
      lat,
      lng,
      regionLabel,
      regionZoneValue: regionRow?.zone_value,
      deptCode: exact.codeDepartement,
    };
    VILLE_CACHE.set(slug, resolved);
    return resolved;
  } catch {
    VILLE_CACHE.set(slug, null);
    return null;
  }
}
