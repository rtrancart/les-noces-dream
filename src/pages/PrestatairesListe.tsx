import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ProviderCard, { type ProviderCardData } from "@/components/search/ProviderCard";
import { resolveZoneSlug, ZoneApiError, type ResolvedZone } from "@/lib/zoneResolver";
import { useZones } from "@/contexts/ZonesContext";
import { haversineDistanceKm } from "@/lib/haversine";

interface CategorieRow {
  id: string;
  nom: string;
  slug: string;
  parent_id: string | null;
  description_seo: string | null;
  contenu_seo: string | null;
}

const SITE_URL =
  typeof window !== "undefined" ? window.location.origin : "https://lesnoces.net";

/* ───────── Helpers ───────── */

function setMeta(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/* ───────── Page ───────── */

export default function PrestatairesListe() {
  const { slugMere = "", slug2 } = useParams<{ slugMere: string; slug2?: string }>();
  const [searchParams] = useSearchParams();
  const rayon = Math.max(1, Math.min(500, parseInt(searchParams.get("rayon") ?? "50", 10) || 50));
  const { bySlug: zoneIndex, loaded: zonesLoaded } = useZones();

  const [categorieMere, setCategorieMere] = useState<CategorieRow | null>(null);
  const [categorieFille, setCategorieFille] = useState<CategorieRow | null>(null);
  const [zone, setZone] = useState<ResolvedZone | null>(null);
  const [providers, setProviders] = useState<ProviderCardData[]>([]);
  const [routeLoading, setRouteLoading] = useState(true);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  /** API failure fallback: text-search on ville ILIKE %slug% */
  const [fallbackSlug, setFallbackSlug] = useState<string | null>(null);

  /* Resolve route → catégorie / zone */
  useEffect(() => {
    if (!zonesLoaded) return;
    let cancelled = false;
    setRouteLoading(true);
    setNotFound(false);
    setCategorieFille(null);
    setZone(null);
    setFallbackSlug(null);

    (async () => {
      // 1. Categorie mère
      const { data: mere } = await supabase
        .from("categories")
        .select("id, nom, slug, parent_id, description_seo, contenu_seo")
        .eq("slug", slugMere)
        .is("parent_id", null)
        .maybeSingle();

      if (cancelled) return;
      if (!mere) {
        setNotFound(true);
        setRouteLoading(false);
        return;
      }
      setCategorieMere(mere);

      // 2. slug2 → fille OU zone
      if (slug2) {
        const { data: fille } = await supabase
          .from("categories")
          .select("id, nom, slug, parent_id, description_seo, contenu_seo")
          .eq("slug", slug2)
          .eq("parent_id", mere.id)
          .maybeSingle();
        if (cancelled) return;

        if (fille) {
          setCategorieFille(fille);
        } else {
          try {
            const resolved = await resolveZoneSlug(slug2, zoneIndex);
            if (cancelled) return;
            if (!resolved) {
              // geo API responded with 0 results → may still be 404, but
              // let providers fetch with text-fallback decide.
              setFallbackSlug(slug2);
            } else {
              setZone(resolved);
            }
          } catch (e) {
            if (cancelled) return;
            if (e instanceof ZoneApiError) {
              // network/timeout → text fallback
              setFallbackSlug(slug2);
            } else {
              setNotFound(true);
              setRouteLoading(false);
              return;
            }
          }
        }
      }

      setRouteLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [slugMere, slug2, zonesLoaded, zoneIndex]);

  /* Fetch prestataires */
  useEffect(() => {
    if (!categorieMere || routeLoading) return;
    let cancelled = false;
    setProvidersLoading(true);

    (async () => {
      let q = supabase
        .from("prestataires")
        .select(
          "id, nom_commercial, slug, description_courte, ville, region, photo_principale_url, note_moyenne, nombre_avis, prix_depart, est_premium, zones_intervention, latitude, longitude, categorie_mere_id, categorie_fille_id"
        )
        .eq("statut", "actif")
        .order("est_premium", { ascending: false })
        .order("note_moyenne", { ascending: false });

      if (categorieFille) {
        q = q.eq("categorie_fille_id", categorieFille.id);
      } else {
        q = q.eq("categorie_mere_id", categorieMere.id);
      }

      // Text-search fallback: filter by ville ILIKE %slug%
      if (fallbackSlug) {
        const term = fallbackSlug.replace(/-/g, " ");
        q = q.ilike("ville", `%${term}%`);
      }

      const { data } = await q;
      if (cancelled || !data) return;

      let result = data as any[];

      if (zone) {
        if (zone.type === "ville") {
          result = result.filter((p) => {
            const inRadius =
              p.latitude != null &&
              p.longitude != null &&
              zone.lat != null &&
              zone.lng != null &&
              haversineDistanceKm(zone.lat, zone.lng, p.latitude, p.longitude) <= rayon;
            const zi: string[] = p.zones_intervention ?? [];
            const coversRegion =
              !!zone.regionZoneValue && zi.includes(zone.regionZoneValue);
            const franceEntiere = zi.includes("france_entiere");
            return inRadius || coversRegion || franceEntiere;
          });
        } else {
          // region OR departement
          result = result.filter((p) => {
            const zi: string[] = p.zones_intervention ?? [];
            if (zi.includes("france_entiere")) return true;
            if (zone.zoneValue && zi.includes(zone.zoneValue)) return true;
            if (zone.type === "region" && p.region === zone.regionLabel) return true;
            if (
              zone.type === "departement" &&
              zone.regionZoneValue &&
              zi.includes(zone.regionZoneValue)
            )
              return true;
            if (zone.type === "departement" && p.region === zone.regionLabel) return true;
            return false;
          });
        }
      }

      setProviders(
        result.map((p) => ({
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
        }))
      );
      setProvidersLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [categorieMere, categorieFille, zone, rayon, routeLoading, fallbackSlug]);

  /* H1 + intro + SEO */
  const seo = useMemo(() => {
    if (!categorieMere) return null;
    const cat = categorieMere.nom;
    const n = providers.length;

    let h1 = "";
    let intro = "";
    let metaZone = "France";

    if (categorieFille) {
      h1 = `Spécialistes en ${categorieFille.nom} pour votre mariage`;
      intro = `${n} prestataires sélectionnés par LesNoces.net.`;
      metaZone = categorieFille.nom;
    } else if (zone?.type === "ville") {
      h1 = `Trouvez votre ${cat} de mariage autour de ${zone.label}`;
      intro = `${n} professionnels disponibles près de chez vous.`;
      metaZone = zone.label;
    } else if (zone) {
      h1 = `Trouvez votre ${cat} de mariage en ${zone.label}`;
      intro = `${n} professionnels disponibles dans votre région.`;
      metaZone = zone.label;
    } else {
      h1 = `Trouvez votre ${cat} de mariage`;
      intro = `${n} professionnels sélectionnés et validés par LesNoces.net.`;
    }

    const metaTitle = `${cat} de mariage en ${metaZone} | LesNoces.net`;
    const canonicalPath = slug2
      ? `/prestataires/${slugMere}/${slug2}`
      : `/prestataires/${slugMere}`;

    return { h1, intro, metaTitle, canonicalUrl: `${SITE_URL}${canonicalPath}` };
  }, [categorieMere, categorieFille, zone, providers.length, slugMere, slug2]);

  useEffect(() => {
    if (!seo) return;
    document.title = seo.metaTitle;
    setMeta(
      "description",
      `${seo.h1}. ${seo.intro} Comparez les meilleurs prestataires sur LesNoces.net.`
    );
    setCanonical(seo.canonicalUrl);
  }, [seo]);

  /* ───── Render ───── */

  // Hard 404: catégorie mère unknown, or fallback text-search returned nothing
  const hardNotFound =
    notFound ||
    (!routeLoading &&
      !providersLoading &&
      fallbackSlug &&
      providers.length === 0 &&
      !zone);

  if (hardNotFound) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-serif text-3xl text-foreground">Page introuvable</h1>
        <p className="font-sans text-sm text-muted-foreground max-w-md">
          Nous n'avons trouvé ni catégorie ni zone correspondant à cette adresse.
        </p>
        <div className="flex flex-wrap gap-3 justify-center mt-2">
          <Link
            to="/recherche"
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded font-sans text-sm"
          >
            Parcourir par catégorie
          </Link>
          <Link
            to="/"
            className="px-5 py-2.5 border border-border rounded font-sans text-sm text-foreground"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  // Skeleton placeholder while route or providers are loading
  const showSkeleton = routeLoading || providersLoading || !seo;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-8 md:py-12">
        <header className="mb-8">
          {seo ? (
            <>
              <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-3">
                {seo.h1}
              </h1>
              <p className="font-sans text-base text-muted-foreground max-w-3xl">
                {seo.intro}
              </p>
            </>
          ) : (
            <>
              <div className="h-9 w-2/3 max-w-xl bg-muted rounded animate-pulse mb-3" />
              <div className="h-5 w-1/2 max-w-md bg-muted rounded animate-pulse" />
            </>
          )}
        </header>

        {fallbackSlug && !showSkeleton && (
          <div className="mb-6 px-4 py-3 bg-muted/50 border border-border rounded text-sm font-sans text-muted-foreground">
            Résultats approximatifs pour «&nbsp;{fallbackSlug.replace(/-/g, " ")}&nbsp;».
          </div>
        )}

        {showSkeleton ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg overflow-hidden border border-border bg-card"
              >
                <div className="aspect-[4/3] bg-muted animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : providers.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-sans text-muted-foreground">
              Aucun prestataire trouvé pour ces critères.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {providers.map((p) => (
              <ProviderCard key={p.id} provider={p} />
            ))}
          </div>
        )}

        {!showSkeleton && categorieMere && (categorieFille?.contenu_seo || categorieMere.contenu_seo) && (
          <section className="mt-16 prose prose-sm max-w-3xl font-sans text-foreground">
            <h2 className="font-serif text-2xl mb-4">À propos</h2>
            <div className="whitespace-pre-line text-muted-foreground">
              {categorieFille?.contenu_seo ?? categorieMere.contenu_seo}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
