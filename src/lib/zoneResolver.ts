import { REGIONS } from "@/lib/zonesIntervention";

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

/* ──────────────── Static index (régions / départements) ──────────────── */

interface RegionIdx {
  slug: string;
  label: string;
  zoneValue: string;
  deptCodes: string[];
}
interface DeptIdx {
  slug: string;
  label: string;
  zoneValue: string; // dept code, e.g. "75"
  regionLabel: string;
  regionSlug: string;
  regionZoneValue: string;
}

const REGION_BY_SLUG = new Map<string, RegionIdx>();
const DEPT_BY_SLUG = new Map<string, DeptIdx>();

for (const r of REGIONS) {
  const rSlug = slugify(r.label);
  const idx: RegionIdx = {
    slug: rSlug,
    label: r.label,
    zoneValue: r.value,
    deptCodes: r.departements.map((d) => d.value),
  };
  REGION_BY_SLUG.set(rSlug, idx);
  for (const d of r.departements) {
    const dSlug = slugify(d.label);
    DEPT_BY_SLUG.set(dSlug, {
      slug: dSlug,
      label: d.label,
      zoneValue: d.value,
      regionLabel: r.label,
      regionSlug: rSlug,
      regionZoneValue: r.value,
    });
  }
}

/* ──────────────── Cache villes ──────────────── */

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

export function listKnownRegionSlugs(): string[] {
  return Array.from(REGION_BY_SLUG.keys());
}

export async function resolveZoneSlug(slug: string): Promise<ResolvedZone | null> {
  if (!slug) return null;

  // 1. Région
  const r = REGION_BY_SLUG.get(slug);
  if (r) {
    return {
      type: "region",
      slug: r.slug,
      label: r.label,
      zoneValue: r.zoneValue,
      regionLabel: r.label,
      regionZoneValue: r.zoneValue,
    };
  }

  // 2. Département
  const d = DEPT_BY_SLUG.get(slug);
  if (d) {
    return {
      type: "departement",
      slug: d.slug,
      label: d.label,
      zoneValue: d.zoneValue,
      regionLabel: d.regionLabel,
      regionZoneValue: d.regionZoneValue,
      deptCode: d.zoneValue,
    };
  }

  // 3. Ville (cache)
  if (VILLE_CACHE.has(slug)) return VILLE_CACHE.get(slug) ?? null;

  try {
    const nom = slug.replace(/-/g, " ");
    const url = `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(nom)}&boost=population&limit=5&fields=nom,code,centre,codeRegion,codeDepartement&format=json`;
    const res = await fetch(url);
    const list = (await res.json()) as Array<any>;
    // Pick the first whose slugified nom matches the input (handles homonymes)
    const exact = list.find((c) => slugify(c.nom) === slug) ?? list[0];
    if (!exact || !exact.centre?.coordinates) {
      VILLE_CACHE.set(slug, null);
      return null;
    }
    const [lng, lat] = exact.centre.coordinates;
    const regionLabel = INSEE_REGION_TO_LABEL[exact.codeRegion];
    const regionEntry = regionLabel ? REGION_BY_SLUG.get(slugify(regionLabel)) : undefined;
    const resolved: ResolvedZone = {
      type: "ville",
      slug,
      label: exact.nom,
      lat,
      lng,
      regionLabel,
      regionZoneValue: regionEntry?.zoneValue,
      deptCode: exact.codeDepartement,
    };
    VILLE_CACHE.set(slug, resolved);
    return resolved;
  } catch {
    VILLE_CACHE.set(slug, null);
    return null;
  }
}
