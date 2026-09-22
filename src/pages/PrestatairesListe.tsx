import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ProviderCard, { type ProviderCardData } from "@/components/search/ProviderCard";
import { resolveZoneSlug, ZoneApiError, type ResolvedZone } from "@/lib/zoneResolver";
import { useZones } from "@/contexts/ZonesContext";
import { usePrerenderStatus } from "@/contexts/PrerenderContext";
import { haversineDistanceKm } from "@/lib/haversine";
import SeoHead from "@/components/SeoHead";
import JsonLd from "@/components/JsonLd";
import CategorieEditorial from "@/components/seo/CategorieEditorial";
import {
  buildCategoryListJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
} from "@/lib/jsonld";
import {
  altPhoto,
  injecteNombre,
  metaDescriptionAuto,
  metaTitreAuto,
  singulier,
  sousTitre,
  titreEditorial,
  titreGrille,
  titreH1,
  titreTypes,
  type ZoneLabel,
} from "@/lib/categorieLabels";

interface FaqItem {
  question: string;
  reponse: string;
}

interface CategorieRow {
  id: string;
  nom: string;
  slug: string;
  parent_id: string | null;
  description_seo: string | null;
  contenu_seo: string | null;
  seo_intro: string | null;
  seo_body: string | null;
  faq: unknown;
  meta_title: string | null;
  meta_description: string | null;
  nom_singulier: string | null;
  genre: string | null;
  updated_at: string;
}

const CATEGORIE_SELECT =
  "id, nom, slug, parent_id, description_seo, contenu_seo, seo_intro, seo_body, faq, meta_title, meta_description, nom_singulier, genre, updated_at";

interface FilleRow {
  id: string;
  nom: string;
  slug: string;
  nb: number;
}

interface ArticleRow {
  slug: string;
  titre: string;
  extrait: string | null;
}

interface RegionRow {
  slug_region: string;
  nom_region: string;
}

const SITE_URL =
  typeof window !== "undefined" ? window.location.origin : "https://lesnoces.net";

function parseFaq(value: unknown): FaqItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      const o = (v ?? {}) as Record<string, unknown>;
      const question = typeof o.question === "string" ? o.question.trim() : "";
      const reponse = typeof o.reponse === "string" ? o.reponse.trim() : "";
      return { question, reponse };
    })
    .filter((q) => q.question && q.reponse);
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
  const [extrasLoading, setExtrasLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  /** API failure fallback: text-search on ville ILIKE %slug% */
  const [fallbackSlug, setFallbackSlug] = useState<string | null>(null);

  /** Nombre de prestataires actifs de la catégorie, lu en base (vue compteurs). */
  const [nbActifs, setNbActifs] = useState<number | null>(null);
  const [filles, setFilles] = useState<FilleRow[]>([]);
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [regions, setRegions] = useState<RegionRow[]>([]);

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
        .select(CATEGORIE_SELECT)
        .eq("slug", slugMere)
        .is("parent_id", null)
        .maybeSingle();

      if (cancelled) return;
      if (!mere) {
        setNotFound(true);
        setRouteLoading(false);
        return;
      }
      setCategorieMere(mere as CategorieRow);

      // 2. slug2 → fille OU zone
      if (slug2) {
        const { data: fille } = await supabase
          .from("categories")
          .select(CATEGORIE_SELECT)
          .eq("slug", slug2)
          .eq("parent_id", mere.id)
          .maybeSingle();
        if (cancelled) return;

        if (fille) {
          setCategorieFille(fille as CategorieRow);
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
        .from("prestataires_public")
        .select(
          "id, nom_commercial, slug, description_courte, ville, region, photo_principale_url, note_moyenne, nombre_avis, prix_depart, est_premium, zones_intervention, latitude, longitude, categorie_mere_id, categorie_fille_id, score_classement, score_tri"
        )
        .eq("statut", "actif")
        .order("score_tri", { ascending: false, nullsFirst: false })
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

  /* Compteur, catégories filles, articles liés, régions — maillage interne */
  useEffect(() => {
    if (!categorieMere || routeLoading) return;
    let cancelled = false;
    setExtrasLoading(true);

    (async () => {
      const cible = categorieFille ?? categorieMere;

      const [compteurs, fillesRes, articlesRes, regionsRes] = await Promise.all([
        supabase
          .from("categories_compteurs")
          .select("id, nb_prestataires_actifs")
          .in("id", [categorieMere.id, ...(categorieFille ? [categorieFille.id] : [])]),
        supabase
          .from("categories")
          .select("id, nom, slug, ordre_affichage")
          .eq("parent_id", categorieMere.id)
          .eq("est_active", true)
          .order("ordre_affichage", { ascending: true }),
        supabase
          .from("articles_blog")
          .select("slug, titre, extrait, publie_le")
          .eq("est_publie", true)
          .eq("categorie_liee_slug", cible.slug)
          .order("publie_le", { ascending: false, nullsFirst: false })
          .limit(6),
        supabase
          .from("pages_regions_mariage")
          .select("slug_region, nom_region")
          .eq("est_publiee", true)
          .order("nom_region", { ascending: true }),
      ]);

      if (cancelled) return;

      const compteurMap = new Map<string, number>(
        (compteurs.data ?? []).map((c: any) => [c.id, c.nb_prestataires_actifs ?? 0]),
      );
      setNbActifs(compteurMap.get(cible.id) ?? null);

      const fillesIds = (fillesRes.data ?? []).map((f: any) => f.id);
      let fillesCompteurs = new Map<string, number>();
      if (fillesIds.length) {
        const { data } = await supabase
          .from("categories_compteurs")
          .select("id, nb_prestataires_actifs")
          .in("id", fillesIds);
        if (cancelled) return;
        fillesCompteurs = new Map(
          (data ?? []).map((c: any) => [c.id, c.nb_prestataires_actifs ?? 0]),
        );
      }

      setFilles(
        (fillesRes.data ?? []).map((f: any) => ({
          id: f.id,
          nom: f.nom,
          slug: f.slug,
          nb: fillesCompteurs.get(f.id) ?? 0,
        })),
      );
      setArticles((articlesRes.data ?? []) as ArticleRow[]);
      setRegions((regionsRes.data ?? []) as RegionRow[]);
      setExtrasLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [categorieMere, categorieFille, routeLoading]);

  const catCible = categorieFille ?? categorieMere;
  const faq = useMemo(() => parseFaq(catCible?.faq), [catCible]);

  const zoneLabel: ZoneLabel | null = useMemo(() => {
    if (!zone) return null;
    return { type: zone.type as ZoneLabel["type"], label: zone.label };
  }, [zone]);

  /** Nombre affiché : compteur base hors filtre géographique, sinon résultats. */
  const nbAffiche = zone || fallbackSlug ? providers.length : (nbActifs ?? providers.length);

  /* H1 + intro + SEO */
  const seo = useMemo(() => {
    if (!categorieMere || !catCible) return null;
    const metaZone = fallbackSlug
      ? fallbackSlug
      : zone
        ? zone.label
        : "France";

    const h1 = fallbackSlug
      ? `Résultats pour «\u00a0${fallbackSlug}\u00a0»`
      : titreH1(catCible, zoneLabel);

    const metaTitle = catCible.meta_title?.trim()
      ? catCible.meta_title.trim()
      : metaTitreAuto(catCible, metaZone);
    const metaDescription = catCible.meta_description?.trim()
      ? injecteNombre(catCible.meta_description.trim(), nbAffiche)
      : metaDescriptionAuto(catCible, nbAffiche, metaZone);

    const canonicalPath = slug2
      ? `/prestataires/${slugMere}/${slug2}`
      : `/prestataires/${slugMere}`;

    return {
      h1,
      metaTitle,
      metaDescription,
      canonicalPath,
      canonicalUrl: `${SITE_URL}${canonicalPath}`,
      metaZone,
    };
  }, [categorieMere, catCible, zone, zoneLabel, nbAffiche, slugMere, slug2, fallbackSlug]);

  /* ───── Render ───── */

  // Hard 404: catégorie mère unknown, or fallback text-search returned nothing
  const hardNotFound =
    notFound ||
    (!routeLoading &&
      !providersLoading &&
      fallbackSlug &&
      providers.length === 0 &&
      !zone);

  // Prêt seulement quand catégorie, comptage, prestataires, éditorial et
  // maillage sont résolus : le snapshot ne doit jamais être capturé partiel.
  usePrerenderStatus(
    hardNotFound
      ? "error"
      : routeLoading || providersLoading || extrasLoading || !seo
        ? "loading"
        : "ready",
  );

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
  const showSkeleton = routeLoading || providersLoading || !seo || !catCible;

  const seoIntro = injecteNombre(catCible?.seo_intro, nbAffiche);
  const seoBody = catCible?.seo_body?.trim() || catCible?.contenu_seo?.trim() || "";
  const majDate = catCible?.updated_at
    ? new Date(catCible.updated_at).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const breadcrumbItems = categorieMere
    ? [
        { name: "Accueil", url: "/" },
        { name: "Prestataires", url: "/recherche" },
        { name: categorieMere.nom, url: `/prestataires/${slugMere}` },
        ...(categorieFille
          ? [
              {
                name: categorieFille.nom,
                url: `/prestataires/${slugMere}/${categorieFille.slug}`,
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="min-h-screen bg-background">
      {seo && catCible && (
        <>
          <SeoHead
            title={seo.metaTitle}
            description={seo.metaDescription}
            canonicalUrl={seo.canonicalUrl}
            siteName="LesNoces.net"
          />
          <JsonLd
            schema={[
              buildCategoryListJsonLd({
                name: seo.h1,
                description: seo.metaDescription,
                canonicalPath: seo.canonicalPath,
                items: providers.map((p, i) => ({
                  name: p.nom_commercial,
                  slug: p.slug,
                  position: i + 1,
                })),
              }),
              buildBreadcrumbJsonLd(breadcrumbItems),
              ...(faq.length ? [buildFaqPageJsonLd(faq)] : []),
            ]}
          />
        </>
      )}

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-8 md:py-12">
        {/* Fil d'ariane */}
        {categorieMere && (
          <nav aria-label="Fil d'ariane" className="mb-5">
            <ol className="flex flex-wrap items-center gap-2 font-sans text-xs text-muted-foreground">
              {breadcrumbItems.map((item, i) => {
                const last = i === breadcrumbItems.length - 1;
                return (
                  <li key={item.url} className="flex items-center gap-2">
                    {last ? (
                      <span className="text-foreground font-semibold">{item.name}</span>
                    ) : (
                      <>
                        <Link to={item.url} className="hover:text-or-riche hover:underline">
                          {item.name}
                        </Link>
                        <span aria-hidden="true">›</span>
                      </>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}

        <header className="mb-8">
          {seo ? (
            <>
              <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-3">
                {seo.h1}
              </h1>
              <p className="font-sans text-base text-muted-foreground max-w-3xl">
                {sousTitre(nbAffiche)}
              </p>
            </>
          ) : (
            <>
              <div className="h-9 w-2/3 max-w-xl bg-muted rounded animate-pulse mb-3" />
              <div className="h-5 w-1/2 max-w-md bg-muted rounded animate-pulse" />
            </>
          )}
        </header>

        {/* Réponse d'emblée */}
        {seoIntro && (
          <section className="mb-8 rounded-xl bg-secondary/40 border border-border px-5 py-5 md:px-7 md:py-6">
            <p className="font-sans text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
              L'essentiel
            </p>
            <div className="font-sans text-[15px] leading-relaxed text-foreground whitespace-pre-line">
              {seoIntro}
            </div>
          </section>
        )}

        {fallbackSlug && !showSkeleton && (
          <div className="mb-6 px-4 py-3 bg-muted/50 border border-border rounded text-sm font-sans text-muted-foreground">
            Résultats approximatifs pour «&nbsp;{fallbackSlug}&nbsp;».
          </div>
        )}

        {/* Grille */}
        {!showSkeleton && catCible && providers.length > 0 && (
          <h2 className="font-serif text-2xl text-foreground mb-5">
            {titreGrille(catCible, providers.length, seo?.metaZone ?? null)}
          </h2>
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
              <ProviderCard
                key={p.id}
                provider={p}
                categorieLabel={catCible ? singulier(catCible) : null}
              />
            ))}
          </div>
        )}

        {/* Éditorial */}
        {!showSkeleton && catCible && seoBody && (
          <section className="mt-16">
            <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-5">
              {titreEditorial(catCible)}
            </h2>
            <CategorieEditorial source={seoBody} />
          </section>
        )}

        {/* Types de … — maillage vers les catégories filles */}
        {!showSkeleton && catCible && filles.length > 0 && (
          <section className="mt-12">
            <h3 className="font-serif text-lg text-foreground mb-4">
              {titreTypes(categorieMere ?? catCible)}
            </h3>
            <ul className="flex flex-wrap gap-3">
              {filles.map((f) => (
                <li key={f.id}>
                  <Link
                    to={`/prestataires/${slugMere}/${f.slug}`}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 font-sans text-sm text-foreground hover:border-or-riche hover:text-or-riche transition-colors"
                  >
                    {f.nom}
                    {f.nb > 0 && (
                      <span className="font-sans text-xs text-muted-foreground">{f.nb}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* FAQ */}
        {!showSkeleton && faq.length > 0 && (
          <section className="mt-14">
            <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-5">
              Questions fréquentes
            </h2>
            <div className="space-y-3">
              {faq.map((q, i) => (
                <details
                  key={i}
                  className="group rounded-xl border border-border bg-card px-5 py-4"
                  open={i === 0}
                >
                  <summary className="cursor-pointer list-none font-sans text-[15px] font-semibold text-foreground marker:hidden">
                    {q.question}
                  </summary>
                  <p className="mt-3 font-sans text-[15px] leading-relaxed text-muted-foreground">
                    {q.reponse}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Maillage régions */}
        {!showSkeleton && catCible && regions.length > 0 && (
          <section className="mt-14">
            <h2 className="font-serif text-2xl text-foreground mb-4">
              Se marier en région
            </h2>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 font-sans text-sm">
              {regions.map((r) => (
                <li key={r.slug_region}>
                  <Link
                    to={`/mariage/${r.slug_region}`}
                    className="text-muted-foreground hover:text-or-riche hover:underline"
                  >
                    Mariage en {r.nom_region}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Articles liés */}
        {!showSkeleton && articles.length > 0 && (
          <section className="mt-14">
            <h2 className="font-serif text-2xl text-foreground mb-4">
              À lire sur le magazine
            </h2>
            <ul className="space-y-3">
              {articles.map((a) => (
                <li key={a.slug}>
                  <Link
                    to={`/blog/${a.slug}`}
                    className="font-sans text-[15px] font-semibold text-foreground hover:text-or-riche hover:underline"
                  >
                    {a.titre}
                  </Link>
                  {a.extrait && (
                    <p className="font-sans text-sm text-muted-foreground line-clamp-2">
                      {a.extrait}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {majDate && !showSkeleton && (
          <p className="mt-12 font-sans text-xs text-muted-foreground">
            Mis à jour le {majDate}
          </p>
        )}
      </div>
    </div>
  );
}
