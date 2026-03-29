import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Star, SlidersHorizontal, MapPin, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import LocationPicker from "@/components/LocationPicker";
import CategoryPicker, { type CategoryOption, getCondensedCategoryNames } from "@/components/CategoryPicker";
import ProviderCard, { type ProviderCardData } from "@/components/search/ProviderCard";
import SearchMap from "@/components/search/SearchMap";
import { useIsMobile } from "@/hooks/use-mobile";
import { REGIONS, DOM, getZoneLabel, getCondensedZoneNames } from "@/lib/zonesIntervention";

/* ─── Hook: fetch data ──────────────────────────────────── */

function useSearchData() {
  const [providers, setProviders] = useState<ProviderCardData[]>([]);
  const [categoryTree, setCategoryTree] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const [prestRes, catRes] = await Promise.all([
        supabase
          .from("prestataires")
          .select("id, nom_commercial, slug, description_courte, ville, region, photo_principale_url, note_moyenne, nombre_avis, prix_depart, est_premium, zones_intervention, categorie_mere_id, categorie_fille_id, latitude, longitude")
          .eq("statut", "actif")
          .order("est_premium", { ascending: false })
          .order("note_moyenne", { ascending: false }),
        supabase
          .from("categories")
          .select("id, nom, slug, icone_url, parent_id")
          .eq("est_active", true)
          .order("ordre_affichage"),
      ]);

      if (catRes.data) {
        const roots = catRes.data.filter((c) => !c.parent_id);
        const tree: CategoryOption[] = roots.map((r) => ({
          id: r.id,
          nom: r.nom,
          slug: r.slug,
          icone_url: r.icone_url,
          children: catRes.data
            .filter((c) => c.parent_id === r.id)
            .map((c) => ({ id: c.id, nom: c.nom, slug: c.slug, icone_url: c.icone_url })),
        }));
        setCategoryTree(tree);
      }

      if (prestRes.data) {
        setProviders(
          prestRes.data.map((p) => ({
            id: p.id,
            nom_commercial: p.nom_commercial,
            slug: p.slug,
            description_courte: p.description_courte,
            ville: p.ville,
            region: p.region,
            photo_principale_url: p.photo_principale_url,
            note_moyenne: p.note_moyenne,
            nombre_avis: p.nombre_avis,
            prix_depart: p.prix_depart,
            est_premium: p.est_premium ?? false,
            zones_intervention: (p as any).zones_intervention ?? [],
            categorie_mere_id: (p as any).categorie_mere_id,
            categorie_fille_id: (p as any).categorie_fille_id,
            latitude: (p as any).latitude,
            longitude: (p as any).longitude,
          }))
        );
      }

      setLoading(false);
    }
    fetch();
  }, []);

  return { providers, categoryTree, loading };
}

/* ─── Helper: zone matching ──────────────────────────────── */

function matchesZones(provider: any, selectedZones: string[]): boolean {
  if (selectedZones.length === 0) return true;
  if (selectedZones.includes("france_entiere")) return true;

  // Match by provider region field
  const regionLabel = provider.region;
  const regionMatch = REGIONS.find((r) => r.label === regionLabel);
  if (regionMatch) {
    const deptValues = regionMatch.departements.map((d) => d.value);
    if (deptValues.some((d) => selectedZones.includes(d))) return true;
    if (selectedZones.includes(regionMatch.value)) return true;
  }

  // Match by zones_intervention
  const zones: string[] = provider.zones_intervention ?? [];
  return zones.some((z: string) => selectedZones.includes(z));
}

/* ─── Page ──────────────────────────────────────────────── */

export default function Recherche() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { providers: allProviders, categoryTree, loading } = useSearchData();
  const isMobile = useIsMobile();

  const [locationZones, setLocationZones] = useState<string[]>(() => {
    const lieu = searchParams.get("lieu");
    return lieu ? lieu.split(",") : [];
  });
  const [categorySlugs, setCategorySlugs] = useState<string[]>(() => {
    const cat = searchParams.get("categorie");
    return cat ? cat.split(",") : [];
  });
  const [priceFilters, setPriceFilters] = useState<string[]>([]);
  const [showMap, setShowMap] = useState(true);
  const [showMobileMap, setShowMobileMap] = useState(false);
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null);

  // Build category ID set from slugs
  const categoryIds = useMemo(() => {
    const ids = new Set<string>();
    for (const cat of categoryTree) {
      if (categorySlugs.includes(cat.slug)) ids.add(cat.id);
      cat.children?.forEach((c) => {
        if (categorySlugs.includes(c.slug)) ids.add(c.id);
      });
    }
    return ids;
  }, [categorySlugs, categoryTree]);

  // Filter providers
  const filteredProviders = useMemo(() => {
    let result = [...allProviders];

    // Category filter
    if (categoryIds.size > 0) {
      result = result.filter(
        (p) =>
          categoryIds.has((p as any).categorie_mere_id) ||
          categoryIds.has((p as any).categorie_fille_id)
      );
    }

    // Location filter
    if (locationZones.length > 0) {
      result = result.filter((p) => matchesZones(p, locationZones));
    }

    // Price filter
    if (priceFilters.length > 0) {
      result = result.filter((p) => {
        if (!p.prix_depart) return false;
        return priceFilters.some((f) => {
          if (f === "€") return p.prix_depart! < 1000;
          if (f === "€€") return p.prix_depart! >= 1000 && p.prix_depart! < 3000;
          if (f === "€€€") return p.prix_depart! >= 3000 && p.prix_depart! < 6000;
          if (f === "€€€€") return p.prix_depart! >= 6000;
          return true;
        });
      });
    }

    return result;
  }, [allProviders, categoryIds, locationZones, priceFilters]);

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (categorySlugs.length > 0) params.set("categorie", categorySlugs.join(","));
    if (locationZones.length > 0) params.set("lieu", locationZones.join(","));
    setSearchParams(params, { replace: true });
  }, [categorySlugs, locationZones]);

  // Dynamic title from filters
  const dynamicTitle = useMemo(() => {
    // Use condensed names (parent only when all children selected)
    const catNames = getCondensedCategoryNames(categoryTree, categorySlugs);

    // Resolve location labels (condensed: region name when all depts selected)
    const locLabels = getCondensedZoneNames(locationZones);

    const catPart = catNames.length > 0 ? catNames.join(", ") : "Prestataires de mariage";
    const locPart = locLabels.length > 0 ? ` à ${locLabels.join(", ")}` : " en France";

    return `${catPart}${locPart}`;
  }, [categorySlugs, locationZones, categoryTree]);

  // SEO title
  useEffect(() => {
    document.title = `${dynamicTitle} | LesNoces.net`;
  }, [dynamicTitle]);

  const togglePrice = (p: string) =>
    setPriceFilters((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const firstFour = showMap && !isMobile ? filteredProviders.slice(0, 4) : [];
  const remaining = showMap && !isMobile ? filteredProviders.slice(4) : filteredProviders;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky search header */}
      <div className="sticky top-20 z-20 bg-card border-b border-border shadow-sm">
        <div className="px-3 md:px-6 py-4">
          <div className="max-w-[2000px] mx-auto">
            {/* Search bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-0 md:justify-between mb-4">
              <div className="flex-1 max-w-3xl">
                <div className="flex flex-col md:flex-row items-stretch md:items-center bg-card border border-border rounded-xl md:rounded-full shadow-sm hover:shadow-card transition-shadow">
                  <div className="flex-1 px-4 md:px-6 py-3 border-b md:border-b-0 md:border-r border-border">
                    <CategoryPicker
                      categories={categoryTree}
                      value={categorySlugs}
                      onChange={setCategorySlugs}
                      placeholder="Tous les prestataires"
                    />
                  </div>
                  <div className="flex-1 px-4 md:px-6 py-3">
                    <LocationPicker
                      value={locationZones}
                      onChange={setLocationZones}
                      placeholder="Où ?"
                    />
                  </div>
                  <Button className="rounded-b-xl md:rounded-full m-0 md:m-1 h-12 px-6 shrink-0 gap-2">
                    <Search size={18} />
                    <span className="font-sans text-sm font-semibold">Rechercher</span>
                  </Button>
                </div>
              </div>
              <button
                onClick={() => setShowMap(!showMap)}
                className="hidden md:flex ml-4 px-5 py-3 border border-border rounded-full hover:border-primary transition-colors font-sans text-sm font-semibold items-center gap-2"
              >
                <MapPin size={18} />
                {showMap ? "Masquer la carte" : "Afficher la carte"}
              </button>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
              <button className="flex-shrink-0 px-4 md:px-5 py-2.5 border border-border rounded-full hover:border-muted-foreground transition-all font-sans text-sm flex items-center gap-2">
                <SlidersHorizontal size={16} />
                <span>Filtres</span>
              </button>

              {["€", "€€", "€€€", "€€€€"].map((price) => (
                <button
                  key={price}
                  onClick={() => togglePrice(price)}
                  className={`flex-shrink-0 px-5 py-2.5 border rounded-full transition-all font-sans text-sm ${
                    priceFilters.includes(price)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground hover:border-muted-foreground"
                  }`}
                >
                  {price}
                </button>
              ))}

              <button className="flex-shrink-0 px-5 py-2.5 border border-border rounded-full hover:border-muted-foreground transition-all font-sans text-sm flex items-center gap-1.5">
                <Star size={14} />
                <span>Excellente note</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="px-3 md:px-6 py-6 md:py-8">
        <div className="max-w-[2000px] mx-auto">
          {filteredProviders.length > 0 ? (
            <>
              <h1 className="font-serif text-2xl md:text-3xl text-foreground mb-2">
                {dynamicTitle}
              </h1>
              <p className="font-sans text-sm text-muted-foreground mb-6">
                Plus de {filteredProviders.length} prestataire{filteredProviders.length > 1 ? "s" : ""}
              </p>

              {/* Top section: 2-col cards + map */}
              {!isMobile && showMap && (
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr] gap-6 mb-8">
                  <div className="md:col-span-2 grid grid-cols-2 gap-6">
                    {firstFour.map((p) => (
                      <div
                        key={p.id}
                        onMouseEnter={() => setHoveredProvider(p.id)}
                        onMouseLeave={() => setHoveredProvider(null)}
                      >
                        <ProviderCard provider={p} />
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block sticky top-[200px] h-[calc(100vh-220px)]">
                    <SearchMap providers={filteredProviders} hoveredId={hoveredProvider} onHover={setHoveredProvider} />
                  </div>
                </div>
              )}

              {/* Remaining providers grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {remaining.map((p) => (
                  <div
                    key={p.id}
                    onMouseEnter={() => setHoveredProvider(p.id)}
                    onMouseLeave={() => setHoveredProvider(null)}
                  >
                    <ProviderCard provider={p} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-secondary/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="font-serif text-2xl text-foreground mb-2">Aucun résultat</h3>
              <p className="font-sans text-muted-foreground mb-6">
                Essayez d'ajuster vos filtres ou votre recherche
              </p>
              <Button
                onClick={() => {
                  setCategorySlugs([]);
                  setLocationZones([]);
                  setPriceFilters([]);
                }}
              >
                Réinitialiser les filtres
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile map button */}
      {isMobile && filteredProviders.length > 0 && (
        <button
          onClick={() => setShowMobileMap(true)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-5 py-3 bg-foreground hover:bg-accent text-background rounded-full shadow-elevated font-sans text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition-all"
        >
          <MapPin size={18} />
          <span>Afficher la carte</span>
          <span className="px-2 py-0.5 bg-background/20 rounded-full text-xs">{filteredProviders.length}</span>
        </button>
      )}

      {/* Mobile map modal */}
      {showMobileMap && (
        <>
          <div className="fixed inset-0 bg-foreground/50 z-50 lg:hidden" onClick={() => setShowMobileMap(false)} />
          <div className="fixed inset-0 z-50 lg:hidden flex flex-col bg-card">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-serif text-xl text-foreground">Carte des prestataires</h3>
              <button onClick={() => setShowMobileMap(false)} className="p-2 hover:bg-secondary/50 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 p-4">
              <SearchMap providers={filteredProviders} hoveredId={null} onHover={() => {}} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
