import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { geoConicConformal, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature, merge } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { supabase } from "@/integrations/supabase/client";
import { useZones } from "@/contexts/ZonesContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";
import topoRaw from "@/assets/geo/france-departements.topo.json";

type DeptProps = { code: string; nom: string };
const topo = topoRaw as unknown as Topology<{
  departements: GeometryCollection<DeptProps>;
}>;

type Row = {
  scope: string;
  zone_value: string | null;
  zone_type: string | null;
  label: string | null;
  parent_region_zone_value: string | null;
  dept_code: string | null;
  categorie_mere_id: string | null;
  categorie_nom: string | null;
  statut: string;
  nb: number;
};

type Vue = "regions" | "departements";
type Perimetre = "parc" | "publies";

const STATUTS_PUBLIES = new Set(["actif"]);

export default function CarteRepartitionPanel() {
  const [vue, setVue] = useState<Vue>("regions");
  const [perimetre, setPerimetre] = useState<Perimetre>("parc");
  const [familleId, setFamilleId] = useState<string | null>(null);
  const [categorieId, setCategorieId] = useState<string | null>(null);
  const [zoneSelectionnee, setZoneSelectionnee] = useState<string | null>(null);

  const { bySlug, byZoneValue } = useZones();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-stats-zones-categories"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_stats_zones_categories");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const { data: familles } = useQuery({
    queryKey: ["admin-familles-categories"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const [f, c] = await Promise.all([
        supabase
          .from("categories_familles")
          .select("id, cle, libelle, ordre_affichage")
          .order("ordre_affichage"),
        supabase
          .from("categories")
          .select("id, nom, famille_id, parent_id, ordre_affichage")
          .is("parent_id", null)
          .order("ordre_affichage"),
      ]);
      if (f.error) throw f.error;
      if (c.error) throw c.error;
      return {
        familles: f.data ?? [],
        categories: c.data ?? [],
      };
    },
  });

  const categoriesFiltrees = useMemo(() => {
    const cats = familles?.categories ?? [];
    return familleId ? cats.filter((c) => c.famille_id === familleId) : cats;
  }, [familles, familleId]);

  /** Lignes retenues après application des filtres client. */
  const rowsFiltrees = useMemo(() => {
    if (!rows) return [];
    const catsAutorisees = categorieId
      ? new Set([categorieId])
      : familleId
        ? new Set(categoriesFiltrees.map((c) => c.id))
        : null;
    return rows.filter((r) => {
      if (perimetre === "publies" && !STATUTS_PUBLIES.has(r.statut)) return false;
      if (catsAutorisees && (!r.categorie_mere_id || !catsAutorisees.has(r.categorie_mere_id)))
        return false;
      return true;
    });
  }, [rows, perimetre, familleId, categorieId, categoriesFiltrees]);

  /**
   * Agrégats cartographiables.
   * Régions : les lignes départementales sont remontées à la région parente.
   * Le comptage DISTINCT par fiche est déjà fait en base au niveau zone × catégorie ;
   * on somme donc les zones, en assumant qu'une fiche déclarant plusieurs départements
   * d'une même région n'est comptée qu'une fois grâce au regroupement par catégorie.
   */
  const parZone = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rowsFiltrees) {
      if (r.scope !== "carte" || !r.zone_value) continue;
      let cle: string | null = null;
      if (vue === "departements") {
        cle = r.zone_type === "departement" ? r.dept_code : null;
        if (!cle && r.zone_type === "region") continue;
      } else {
        cle =
          r.zone_type === "region" ? r.zone_value : (r.parent_region_zone_value ?? null);
      }
      if (!cle) continue;
      map.set(cle, (map.get(cle) ?? 0) + Number(r.nb));
    }
    return map;
  }, [rowsFiltrees, vue]);

  const parZoneEtCategorie = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const r of rowsFiltrees) {
      if (r.scope !== "carte" || !r.zone_value) continue;
      const cle =
        vue === "departements"
          ? r.zone_type === "departement"
            ? r.dept_code
            : null
          : r.zone_type === "region"
            ? r.zone_value
            : r.parent_region_zone_value;
      if (!cle) continue;
      const nom = r.categorie_nom ?? "Sans catégorie";
      const inner = map.get(cle) ?? new Map<string, number>();
      inner.set(nom, (inner.get(nom) ?? 0) + Number(r.nb));
      map.set(cle, inner);
    }
    return map;
  }, [rowsFiltrees, vue]);

  const totalHorsCarte = useMemo(
    () =>
      rowsFiltrees
        .filter((r) => r.scope === "hors_carte")
        .reduce((acc, r) => acc + Number(r.nb), 0),
    [rowsFiltrees]
  );
  const totalNonLocalise = useMemo(
    () =>
      rowsFiltrees
        .filter((r) => r.scope === "non_localise")
        .reduce((acc, r) => acc + Number(r.nb), 0),
    [rowsFiltrees]
  );

  /** Géométries projetées : départements bruts, ou régions fusionnées à la volée. */
  const formes = useMemo(() => {
    const deptCollection = feature(topo, topo.objects.departements) as unknown as {
      features: Array<{ properties: DeptProps; geometry: unknown }>;
    };

    let items: Array<{ cle: string; nom: string; geometry: GeoPermissibleObjects }>;

    if (vue === "departements") {
      items = deptCollection.features.map((f) => ({
        cle: f.properties.code,
        nom: f.properties.nom,
        geometry: f as unknown as GeoPermissibleObjects,
      }));
    } else {
      const groupes = new Map<string, typeof topo.objects.departements.geometries>();
      for (const g of topo.objects.departements.geometries) {
        const code = (g.properties as DeptProps).code;
        const ref = byZoneValue.get(code);
        const regionValue = ref?.parent_region_zone_value;
        if (!regionValue) continue;
        const arr = groupes.get(regionValue) ?? [];
        arr.push(g);
        groupes.set(regionValue, arr);
      }
      items = Array.from(groupes.entries()).map(([regionValue, geoms]) => ({
        cle: regionValue,
        nom:
          byZoneValue.get(regionValue)?.label ??
          bySlug.get(regionValue)?.label ??
          regionValue,
        geometry: merge(
          topo,
          geoms as unknown as Parameters<typeof merge>[1]
        ) as unknown as GeoPermissibleObjects,
      }));
    }

    const projection = geoConicConformal()
      .center([2.454071, 46.279229])
      .scale(2600)
      .translate([300, 300]);
    const chemin = geoPath(projection);

    return items
      .map((i) => ({ ...i, d: chemin(i.geometry) }))
      .filter((i): i is typeof i & { d: string } => Boolean(i.d));
  }, [vue, byZoneValue, bySlug]);

  const maxNb = useMemo(
    () => Math.max(1, ...Array.from(parZone.values())),
    [parZone]
  );

  const couleur = (nb: number) => {
    if (!nb) return "hsl(var(--muted))";
    const ratio = Math.sqrt(nb / maxNb);
    // Dégradé Champagne → Or Riche
    const opacite = 0.15 + ratio * 0.85;
    return `hsl(var(--or-riche) / ${opacite.toFixed(2)})`;
  };

  const classement = useMemo(
    () =>
      formes
        .map((f) => ({ cle: f.cle, nom: f.nom, nb: parZone.get(f.cle) ?? 0 }))
        .sort((a, b) => b.nb - a.nb),
    [formes, parZone]
  );

  const detail = useMemo(() => {
    if (!zoneSelectionnee) return null;
    const inner = parZoneEtCategorie.get(zoneSelectionnee);
    const nom = formes.find((f) => f.cle === zoneSelectionnee)?.nom ?? zoneSelectionnee;
    return {
      nom,
      total: parZone.get(zoneSelectionnee) ?? 0,
      categories: Array.from(inner?.entries() ?? []).sort((a, b) => b[1] - a[1]),
    };
  }, [zoneSelectionnee, parZoneEtCategorie, parZone, formes]);

  const changerVue = (v: Vue) => {
    setVue(v);
    setZoneSelectionnee(null);
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 font-serif text-base font-semibold">
            <MapPin className="h-4 w-4 text-primary" />
            Répartition géographique du parc
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-md border border-border p-0.5">
              {(["regions", "departements"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => changerVue(v)}
                  className={`rounded px-2.5 py-1 font-sans text-xs transition-colors ${
                    vue === v
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v === "regions" ? "Régions" : "Départements"}
                </button>
              ))}
            </div>
            <div className="flex rounded-md border border-border p-0.5">
              {(
                [
                  ["parc", "Tout le parc"],
                  ["publies", "Publiées"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setPerimetre(v)}
                  className={`rounded px-2.5 py-1 font-sans text-xs transition-colors ${
                    perimetre === v
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Filtres catégories */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <FiltreChip
              actif={!familleId}
              onClick={() => {
                setFamilleId(null);
                setCategorieId(null);
              }}
            >
              Toutes familles
            </FiltreChip>
            {(familles?.familles ?? []).map((f) => (
              <FiltreChip
                key={f.id}
                actif={familleId === f.id}
                onClick={() => {
                  setFamilleId(familleId === f.id ? null : f.id);
                  setCategorieId(null);
                }}
              >
                {f.libelle}
              </FiltreChip>
            ))}
          </div>
          {familleId && (
            <div className="flex flex-wrap gap-1.5 border-t border-border pt-2">
              <FiltreChip actif={!categorieId} onClick={() => setCategorieId(null)}>
                Toutes catégories
              </FiltreChip>
              {categoriesFiltrees.map((c) => (
                <FiltreChip
                  key={c.id}
                  actif={categorieId === c.id}
                  onClick={() => setCategorieId(categorieId === c.id ? null : c.id)}
                >
                  {c.nom}
                </FiltreChip>
              ))}
            </div>
          )}
        </div>

        {isLoading ? (
          <Skeleton className="h-[320px] w-full rounded-lg" />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* Carte */}
            <div className="rounded-lg bg-champagne/20 p-2">
              <svg
                viewBox="0 0 600 600"
                className="h-auto w-full"
                role="img"
                aria-label="Carte de répartition des prestataires en France"
              >
                {formes.map((f) => {
                  const nb = parZone.get(f.cle) ?? 0;
                  const selectionne = zoneSelectionnee === f.cle;
                  return (
                    <path
                      key={f.cle}
                      d={f.d}
                      fill={couleur(nb)}
                      stroke={selectionne ? "hsl(var(--primary))" : "hsl(var(--border))"}
                      strokeWidth={selectionne ? 2 : 0.5}
                      className="cursor-pointer transition-colors"
                      onClick={() =>
                        setZoneSelectionnee(selectionne ? null : f.cle)
                      }
                    >
                      <title>{`${f.nom} — ${nb}`}</title>
                    </path>
                  );
                })}
              </svg>
              <div className="mt-2 flex flex-wrap items-center gap-3 px-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-sans text-[10px] text-muted-foreground">0</span>
                  <div className="h-2 w-24 rounded-full bg-gradient-to-r from-champagne to-or-riche" />
                  <span className="font-sans text-[10px] text-muted-foreground">
                    {maxNb}
                  </span>
                </div>
                <p className="font-sans text-[10px] text-muted-foreground">
                  Une fiche est comptée dans chaque zone qu'elle couvre : les totaux par
                  zone ne s'additionnent pas au nombre total de fiches.
                </p>
              </div>
            </div>

            {/* Détail + classement */}
            <div className="space-y-4">
              {detail && (
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-sans text-sm font-medium text-foreground">
                      {detail.nom}
                    </p>
                    <Badge className="bg-primary/10 font-sans text-[10px] font-normal text-primary">
                      {detail.total} fiche{detail.total > 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <div className="mt-2 space-y-1">
                    {detail.categories.length === 0 ? (
                      <p className="font-sans text-xs text-muted-foreground">
                        Aucune fiche sur ce périmètre.
                      </p>
                    ) : (
                      detail.categories.map(([nom, nb]) => (
                        <div
                          key={nom}
                          className="flex items-center justify-between font-sans text-xs"
                        >
                          <span className="truncate text-muted-foreground">{nom}</span>
                          <span className="ml-2 font-medium text-foreground">{nb}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-7 font-sans text-[11px] text-muted-foreground"
                    onClick={() => setZoneSelectionnee(null)}
                  >
                    Effacer la sélection
                  </Button>
                </div>
              )}

              <div className="rounded-lg border border-border">
                <p className="border-b border-border px-3 py-2 font-sans text-xs uppercase tracking-wider text-muted-foreground">
                  Classement des zones
                </p>
                <div className="max-h-[260px] overflow-auto">
                  <table className="w-full">
                    <caption className="sr-only">
                      Nombre de prestataires par zone, trié par ordre décroissant
                    </caption>
                    <tbody className="divide-y divide-border">
                      {classement.map((z) => (
                        <tr
                          key={z.cle}
                          onClick={() =>
                            setZoneSelectionnee(
                              zoneSelectionnee === z.cle ? null : z.cle
                            )
                          }
                          className={`cursor-pointer transition-colors hover:bg-muted/10 ${
                            zoneSelectionnee === z.cle ? "bg-primary/5" : ""
                          }`}
                        >
                          <td className="px-3 py-1.5 font-sans text-xs text-foreground">
                            {z.nom}
                          </td>
                          <td className="px-3 py-1.5 text-right font-sans text-xs font-medium text-foreground">
                            {z.nb}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 font-sans text-[11px] text-muted-foreground">
                <span>
                  Hors carte (France entière, étranger) :{" "}
                  <strong className="text-foreground">{totalHorsCarte}</strong>
                </span>
                <span>
                  Non localisées :{" "}
                  <strong className="text-foreground">{totalNonLocalise}</strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FiltreChip({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 font-sans text-[11px] transition-colors ${
        actif
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
