import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { regionSlugToNom } from "@/lib/regions";
import { MapPin, Star, ChevronRight, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── Types ─────────────────────────────────────────────── */

interface RegionPage {
  id: string;
  slug_region: string;
  nom_region: string;
  intro_editoriale: string | null;
  specificites: Array<{ titre: string; texte: string; couleur_accent?: string }>;
  conseils: Array<{ titre: string; texte: string }>;
  faq: Array<{ question: string; reponse: string }>;
  citation_llm: string | null;
  budget_moyen: number | null;
  budget_min: number | null;
  budget_max: number | null;
  meilleure_periode: string | null;
  delai_reservation: string | null;
  contenu_seo_bas: string | null;
  image_hero_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  est_publiee: boolean;
}

interface PageStats {
  nb_prestataires: number;
  nb_villes: number;
  nb_categories: number;
  note_moyenne: number;
  nb_avis: number;
}

interface CategoryPill {
  id: string;
  nom: string;
  slug: string;
  nb: number;
}

interface CoupCoeurPresta {
  id: string;
  nom_commercial: string;
  slug: string;
  ville: string;
  note_moyenne: number | null;
  nombre_avis: number | null;
  photo_principale_url: string | null;
  description_courte: string | null;
  categorie_nom: string;
}

interface Ville {
  ville: string;
  nb: number;
}

interface BudgetCategorie {
  categorie: string;
  budget_moyen: number;
  budget_min: number;
  budget_max: number;
}

interface ArticleLie {
  titre: string;
  slug: string;
  extrait: string | null;
  image_couverture_url: string | null;
  categorie_blog: string | null;
  auteur: string | null;
  temps_lecture: number | null;
}

/* ─── Helpers ───────────────────────────────────────────── */

const fmtNb = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const fmtEur = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("fr-FR").format(n) + " €";

function inlineBold(text: string): string {
  // Permet **gras** dans les FAQ et citation
  return text.replace(/\*\*(.+?)\*\*/g, '<strong class="text-bleu-abysse">$1</strong>');
}

function renderInline(text: string) {
  return <span dangerouslySetInnerHTML={{ __html: inlineBold(text) }} />;
}

/* ─── Page principale ───────────────────────────────────── */

export default function MariageRegion() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<RegionPage | null>(null);
  const [stats, setStats] = useState<PageStats>({
    nb_prestataires: 0,
    nb_villes: 0,
    nb_categories: 0,
    note_moyenne: 0,
    nb_avis: 0,
  });
  const [categories, setCategories] = useState<CategoryPill[]>([]);
  const [coups, setCoups] = useState<CoupCoeurPresta[]>([]);
  const [villes, setVilles] = useState<Ville[]>([]);
  const [totalVilles, setTotalVilles] = useState(0);
  const [budgets, setBudgets] = useState<BudgetCategorie[]>([]);
  const [articles, setArticles] = useState<ArticleLie[]>([]);
  const [nbLieux, setNbLieux] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("toutes");

  const nomRegion = slug ? regionSlugToNom(slug) : undefined;

  useEffect(() => {
    if (!slug) return;
    if (!nomRegion) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);

      // 1. Page éditoriale
      const { data: pageData, error: pageErr } = await supabase
        .from("pages_regions_mariage")
        .select("*")
        .eq("slug_region", slug!)
        .maybeSingle();

      if (cancelled) return;

      if (pageErr || !pageData || !pageData.est_publiee) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setPage(pageData as unknown as RegionPage);

      // 2. Données dynamiques en parallèle
      const [prestaRes, catsRes, articlesRes] = await Promise.all([
        supabase
          .from("prestataires")
          .select("id, nom_commercial, slug, ville, note_moyenne, nombre_avis, photo_principale_url, categorie_mere_id, description_courte, est_premium, prix_depart, prix_max")
          .eq("region", nomRegion!)
          .eq("statut", "actif"),
        supabase
          .from("categories")
          .select("id, nom, slug, parent_id")
          .is("parent_id", null)
          .eq("est_active", true),
        supabase
          .from("articles_blog")
          .select("titre, slug, extrait, image_couverture_url, categorie_blog, auteur, temps_lecture, regions_liees, est_publie, publie_le")
          .eq("est_publie", true)
          .contains("regions_liees", [slug!])
          .order("publie_le", { ascending: false, nullsFirst: false })
          .limit(3),
      ]);

      if (cancelled) return;

      const prestas = prestaRes.data ?? [];
      const cats = catsRes.data ?? [];
      const catMap = new Map(cats.map((c) => [c.id, { nom: c.nom, slug: c.slug }]));

      // Stats
      const villesSet = new Set(prestas.map((p) => p.ville).filter(Boolean));
      const catsActives = new Set(prestas.map((p) => p.categorie_mere_id).filter(Boolean));
      const notes = prestas.map((p) => p.note_moyenne).filter((n): n is number => n != null && n > 0);
      const avg = notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : 0;
      const totAvis = prestas.reduce((s, p) => s + (p.nombre_avis ?? 0), 0);

      setStats({
        nb_prestataires: prestas.length,
        nb_villes: villesSet.size,
        nb_categories: catsActives.size,
        note_moyenne: Math.round(avg * 10) / 10,
        nb_avis: totAvis,
      });

      // Pills catégories (tri par nb)
      const catCount = new Map<string, number>();
      prestas.forEach((p) => {
        if (p.categorie_mere_id) {
          catCount.set(p.categorie_mere_id, (catCount.get(p.categorie_mere_id) ?? 0) + 1);
        }
      });
      const pills: CategoryPill[] = [];
      catCount.forEach((nb, id) => {
        const c = catMap.get(id);
        if (c) pills.push({ id, nom: c.nom, slug: c.slug, nb });
      });
      pills.sort((a, b) => b.nb - a.nb);
      setCategories(pills);

      // Nombre de lieux de réception
      const lieuxCat = cats.find((c) => c.slug === "lieux-de-reception");
      const nbLieuxCount = lieuxCat
        ? prestas.filter((p) => p.categorie_mere_id === lieuxCat.id).length
        : 0;
      setNbLieux(nbLieuxCount);

      // Coups de cœur (premium + top notes)
      const premiums = prestas
        .filter((p) => p.est_premium)
        .sort((a, b) => (b.note_moyenne ?? 0) - (a.note_moyenne ?? 0));
      const fallbackTop = prestas
        .filter((p) => !p.est_premium)
        .sort((a, b) => (b.note_moyenne ?? 0) - (a.note_moyenne ?? 0));
      const coupsLot = [...premiums, ...fallbackTop].slice(0, 3);
      setCoups(
        coupsLot.map((p) => ({
          id: p.id,
          nom_commercial: p.nom_commercial,
          slug: p.slug,
          ville: p.ville,
          note_moyenne: p.note_moyenne,
          nombre_avis: p.nombre_avis,
          photo_principale_url: p.photo_principale_url,
          description_courte: p.description_courte,
          categorie_nom: p.categorie_mere_id ? catMap.get(p.categorie_mere_id)?.nom ?? "" : "",
        }))
      );

      // Top villes
      const villeCount = new Map<string, number>();
      prestas.forEach((p) => {
        if (p.ville) villeCount.set(p.ville, (villeCount.get(p.ville) ?? 0) + 1);
      });
      const villesArr = Array.from(villeCount.entries())
        .map(([ville, nb]) => ({ ville, nb }))
        .sort((a, b) => b.nb - a.nb);
      setTotalVilles(villesArr.length);
      setVilles(villesArr.slice(0, 5));

      // Budgets par catégorie
      const budgetByCat = new Map<string, { sum: number; n: number; min: number; max: number }>();
      prestas.forEach((p) => {
        if (!p.categorie_mere_id || p.prix_depart == null) return;
        const cur = budgetByCat.get(p.categorie_mere_id) ?? {
          sum: 0,
          n: 0,
          min: Infinity,
          max: 0,
        };
        cur.sum += p.prix_depart;
        cur.n += 1;
        if (p.prix_depart < cur.min) cur.min = p.prix_depart;
        const max = p.prix_max ?? p.prix_depart;
        if (max > cur.max) cur.max = max;
        budgetByCat.set(p.categorie_mere_id, cur);
      });
      const budgetArr: BudgetCategorie[] = [];
      budgetByCat.forEach((v, id) => {
        const c = catMap.get(id);
        if (c && v.n > 0) {
          budgetArr.push({
            categorie: c.nom,
            budget_moyen: Math.round(v.sum / v.n),
            budget_min: v.min === Infinity ? 0 : v.min,
            budget_max: v.max,
          });
        }
      });
      budgetArr.sort((a, b) => b.budget_moyen - a.budget_moyen);
      setBudgets(budgetArr);

      // Articles liés
      setArticles(
        (articlesRes.data ?? []).map((a) => ({
          titre: a.titre,
          slug: a.slug,
          extrait: a.extrait,
          image_couverture_url: a.image_couverture_url,
          categorie_blog: a.categorie_blog,
          auteur: a.auteur,
          temps_lecture: a.temps_lecture,
        }))
      );

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, nomRegion]);

  if (notFound) return <Navigate to="/404" replace />;

  if (loading || !page) {
    return (
      <div className="bg-background min-h-screen">
        <div className="max-w-[1099px] mx-auto px-6 lg:px-8 py-12 space-y-8">
          <Skeleton className="h-[480px] w-full rounded-md" />
          <Skeleton className="h-32 w-full rounded-md" />
          <Skeleton className="h-64 w-full rounded-md" />
        </div>
      </div>
    );
  }

  // ── SEO/JSON-LD ──
  const metaTitle =
    page.meta_title ||
    `Mariage en ${page.nom_region} — Prestataires & Conseils | LesNoces.net`;
  const metaDesc =
    page.meta_description ||
    `Trouvez les meilleurs prestataires de mariage en ${page.nom_region}. ${stats.nb_prestataires} professionnels validés par LesNoces dans ${stats.nb_villes} villes.`;
  const canonical = `https://lesnoces.net/mariage/${page.slug_region}`;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `Mariage en ${page.nom_region}`,
    url: canonical,
    description: page.citation_llm || metaDesc,
    about: {
      "@type": "Place",
      name: page.nom_region,
      areaServed: page.nom_region,
    },
  };
  if (stats.nb_avis > 0 && stats.note_moyenne > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: stats.note_moyenne.toFixed(1),
      reviewCount: stats.nb_avis,
      bestRating: "5",
    };
  }
  if (page.faq && page.faq.length > 0) {
    jsonLd.hasPart = {
      "@type": "FAQPage",
      mainEntity: page.faq.map((q) => ({
        "@type": "Question",
        name: q.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: q.reponse.replace(/\*\*/g, ""),
        },
      })),
    };
  }

  // ── Helpers couleur catégorie pour cards ──
  const catColor = (idx: number) =>
    ["bg-or-riche/15 text-or-riche", "bg-terracotta/15 text-terracotta", "bg-bleu-petrole/15 text-bleu-petrole", "bg-sauge/15 text-sauge"][
      idx % 4
    ];

  return (
    <>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDesc} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url" content={canonical} />
        {page.image_hero_url && <meta property="og:image" content={page.image_hero_url} />}
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="bg-background">
        {/* Breadcrumb */}
        <nav aria-label="Fil d'ariane" className="bg-[#F0EBE3] border-b border-nude-poudre/60 px-6 lg:px-8 py-3">
          <div className="max-w-[1099px] mx-auto text-xs text-gris-cachemire">
            <Link to="/" className="hover:text-or-riche-riche">Accueil</Link>
            <span className="mx-1.5">›</span>
            <span className="text-or-riche">Mariage par région</span>
            <span className="mx-1.5">›</span>
            <span>{page.nom_region}</span>
          </div>
        </nav>

        {/* HERO */}
        <section className="relative h-[420px] md:h-[480px] overflow-hidden">
          {page.image_hero_url ? (
            <img
              src={page.image_hero_url}
              alt={`Mariage en ${page.nom_region}`}
              fetchPriority="high"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-champagne to-or-riche" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-abysse/10 to-abysse/75" />
          <div className="absolute inset-x-0 bottom-0 px-6 lg:px-12 py-10 max-w-[1099px] mx-auto">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-8 h-px bg-champagne inline-block" />
              <span className="text-champagne text-[11px] tracking-[0.18em] uppercase font-medium">
                Organiser son mariage
              </span>
            </div>
            <h1 className="font-serif text-white text-4xl md:text-6xl leading-[1.05] font-normal mb-4">
              Mariage en <em className="font-serif">{page.nom_region}</em>
            </h1>
            {page.intro_editoriale && (
              <p className="text-white/85 text-base md:text-lg leading-relaxed max-w-2xl">
                {page.intro_editoriale}
              </p>
            )}
            <div className="flex gap-2 mt-5 flex-wrap">
              <span className="bg-bleu-petrole/20 text-white text-[11px] px-3 py-1 rounded-full font-semibold tracking-wider">
                {fmtNb(stats.nb_prestataires)} prestataires validés
              </span>
              <span className="bg-bleu-petrole/20 text-white text-[11px] px-3 py-1 rounded-full font-semibold tracking-wider">
                {fmtNb(stats.nb_villes)} villes couvertes
              </span>
            </div>
          </div>
        </section>

        {/* EN RÉSUMÉ — LLM-first */}
        <section className="bg-champagne/30 border-b border-nude-poudre/60 py-8 md:py-10">
          <div className="max-w-[1099px] mx-auto px-6 lg:px-8">
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <span className="w-6 h-px bg-or-riche inline-block" />
              <span className="text-[11px] tracking-[0.14em] uppercase font-semibold text-or-riche">
                En résumé
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <ResumeCard
                value={`${fmtNb(stats.nb_prestataires)} prestataires`}
                sub={`validés sur ${fmtNb(stats.nb_villes)} villes`}
              />
              <ResumeCard
                value={page.budget_moyen ? `${fmtNb(page.budget_moyen)} € en moyenne` : "Budget sur mesure"}
                sub={
                  page.budget_min && page.budget_max
                    ? `fourchette ${Math.round(page.budget_min / 1000)}k – ${Math.round(page.budget_max / 1000)}k €`
                    : "à définir avec votre prestataire"
                }
              />
              <ResumeCard
                value={page.meilleure_periode || "Toute l'année"}
                sub="meilleures périodes"
              />
              <ResumeCard
                value={page.delai_reservation || "12 à 18 mois"}
                sub="délai de réservation recommandé"
              />
              <ResumeCard
                wide
                value={`${stats.note_moyenne.toFixed(1)}/5 de note moyenne`}
                sub={`sur ${fmtNb(stats.nb_avis)} avis vérifiés · tous prestataires validés manuellement par LesNoces`}
              />
            </div>
          </div>
        </section>

        {/* STATS */}
        <section className="py-10 md:py-12">
          <div className="max-w-[1099px] mx-auto px-6 lg:px-8">
            <SectionLabel auto>La région en chiffres</SectionLabel>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <StatBox value={fmtNb(stats.nb_prestataires)} label="Prestataires" />
              <StatBox value={stats.note_moyenne ? stats.note_moyenne.toFixed(1) : "—"} label="Note moyenne" />
              <StatBox value={fmtNb(stats.nb_categories)} label="Catégories" />
              <StatBox value={fmtNb(stats.nb_villes)} label="Villes" />
            </div>
          </div>
        </section>

        {/* SPÉCIFICITÉS */}
        {page.specificites && page.specificites.length > 0 && (
          <section className="bg-secondary/30 py-10 md:py-14">
            <div className="max-w-[1099px] mx-auto px-6 lg:px-8">
              <SectionLabel editorial>Ce qui rend cette région unique</SectionLabel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {page.specificites.map((s, i) => (
                  <div
                    key={i}
                    className="bg-card p-4 md:p-5 rounded-r-lg"
                    style={{ borderLeft: `2px solid ${s.couleur_accent || "#A57D27"}` }}
                  >
                    <h3 className="text-sm font-semibold text-bleu-abysse mb-1.5">{s.titre}</h3>
                    <p className="text-xs md:text-[13px] text-gris-cachemire leading-relaxed">{s.texte}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* PRESTATAIRES */}
        <section className="py-10 md:py-14">
          <div className="max-w-[1099px] mx-auto px-6 lg:px-8">
            <SectionLabel auto>Parcourir par catégorie</SectionLabel>
            <div className="flex gap-2 flex-wrap mb-8">
              <CategoryPillBtn
                active={activeCategory === "toutes"}
                onClick={() => setActiveCategory("toutes")}
                label={`Toutes (${stats.nb_prestataires})`}
              />
              {categories.map((c) => (
                <Link
                  key={c.id}
                  to={`/recherche?categorie=${c.slug}&lieu=${encodeURIComponent(page.nom_region)}`}
                  className="text-xs px-3.5 py-1.5 border border-nude-poudre rounded-full text-gris-cachemire hover:text-or-riche-riche hover:border-or-riche-riche transition-colors"
                >
                  {c.nom} ({c.nb})
                </Link>
              ))}
            </div>

            {coups.length > 0 && (
              <>
                <SectionLabel editorial className="!mb-4">Nos coups de cœur</SectionLabel>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 mb-6">
                  {coups.map((p, idx) => (
                    <Link
                      key={p.id}
                      to={`/prestataire/${p.slug}`}
                      className="group block border border-nude-poudre/80 rounded-lg overflow-hidden bg-card hover:border-or-riche-riche transition-colors"
                    >
                      <div className="aspect-[4/3] bg-secondary/30">
                        {p.photo_principale_url ? (
                          <img
                            src={p.photo_principale_url}
                            alt={p.nom_commercial}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-nude-poudre to-champagne" />
                        )}
                      </div>
                      <div className="p-3">
                        {p.categorie_nom && (
                          <span
                            className={`inline-block ${catColor(idx)} text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded`}
                          >
                            {p.categorie_nom}
                          </span>
                        )}
                        <h3 className="font-serif text-base text-bleu-abysse mt-1.5 leading-snug">
                          {p.nom_commercial}
                        </h3>
                        <div className="text-[11px] text-gris-cachemire mt-0.5">{p.ville}</div>
                        <div className="text-[11px] text-or-riche mt-1 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-or-riche" />
                          {p.note_moyenne?.toFixed(1) ?? "—"} · {p.nombre_avis ?? 0} avis
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}

            <div className="text-center">
              <Link
                to={`/recherche?lieu=${encodeURIComponent(page.nom_region)}`}
                className="inline-block font-serif italic text-bleu-abysse border-b border-or-riche pb-0.5 hover:text-or-riche-riche transition-colors"
              >
                Voir les {fmtNb(stats.nb_prestataires)} prestataires en {page.nom_region} →
              </Link>
            </div>
          </div>
        </section>

        {/* VILLES */}
        {villes.length > 0 && (
          <section className="bg-secondary/30 py-10 md:py-14">
            <div className="max-w-[1099px] mx-auto px-6 lg:px-8">
              <SectionLabel auto>Mariage par ville</SectionLabel>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                {villes.map((v) => (
                  <Link
                    key={v.ville}
                    to={`/recherche?lieu=${encodeURIComponent(v.ville)}`}
                    className="border border-nude-poudre/80 rounded-lg p-3 px-4 bg-card hover:border-or-riche-riche transition-colors"
                  >
                    <div className="text-sm font-medium text-bleu-abysse">{v.ville}</div>
                    <div className="text-[11px] text-or-riche mt-0.5">{v.nb} prestataires</div>
                  </Link>
                ))}
                {totalVilles > 5 && (
                  <Link
                    to={`/recherche?lieu=${encodeURIComponent(page.nom_region)}`}
                    className="border border-nude-poudre/80 rounded-lg p-3 px-4 bg-card hover:border-or-riche-riche transition-colors flex items-center justify-center text-center"
                  >
                    <div>
                      <div className="text-sm font-medium text-gris-cachemire">+ {totalVilles - 5} autres villes</div>
                      <div className="text-[11px] text-or-riche mt-0.5">Voir toutes →</div>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}

        {/* CONSEILS */}
        {page.conseils && page.conseils.length > 0 && (
          <section className="py-10 md:py-14">
            <div className="max-w-[1099px] mx-auto px-6 lg:px-8">
              <SectionLabel editorial>
                Conseils pour un mariage en {page.nom_region}
              </SectionLabel>
              <div className="space-y-3">
                {page.conseils.map((c, i) => (
                  <div
                    key={i}
                    className="bg-card border border-nude-poudre/80 rounded-lg p-4 md:p-5 flex gap-4 items-start"
                  >
                    <span className="font-serif italic text-or-riche text-2xl leading-none w-8 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-bleu-abysse mb-1.5">{c.titre}</h3>
                      <p className="text-xs md:text-[13px] text-gris-cachemire leading-relaxed">{c.texte}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* TABLEAU BUDGETS */}
        {budgets.length > 0 && (
          <section className="py-10 md:py-14 bg-card">
            <div className="max-w-[1099px] mx-auto px-6 lg:px-8">
              <div className="flex items-center gap-2 mb-5 flex-wrap">
                <span className="text-[10px] uppercase tracking-[0.08em] text-gris-cachemire font-medium">
                  Budget par type de prestation
                </span>
              </div>
              <div className="overflow-x-auto border border-nude-poudre/80 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bleu-petrole text-white">
                      <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.08em] font-semibold">
                        Prestation
                      </th>
                      <th className="text-right px-4 py-3 text-[10px] uppercase tracking-[0.08em] font-semibold">
                        Budget moyen {page.nom_region}
                      </th>
                      <th className="text-right px-4 py-3 text-[10px] uppercase tracking-[0.08em] font-semibold">
                        Fourchette
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgets.map((b, i) => (
                      <tr key={b.categorie} className={i % 2 === 0 ? "bg-card" : "bg-secondary/30"}>
                        <td className="px-4 py-3 font-medium text-bleu-abysse">{b.categorie}</td>
                        <td className="px-4 py-3 text-right text-or-riche font-semibold">{fmtEur(b.budget_moyen)}</td>
                        <td className="px-4 py-3 text-right text-gris-cachemire">
                          {fmtEur(b.budget_min)} – {fmtEur(b.budget_max)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[11px] text-gris-cachemire italic">
                Calculé automatiquement depuis les prix déclarés par les prestataires LesNoces · mis à jour en continu
              </p>
            </div>
          </section>
        )}

        {/* ARTICLES BLOG LIÉS */}
        {articles.length > 0 && (
          <section className="bg-secondary/30 py-10 md:py-14">
            <div className="max-w-[1099px] mx-auto px-6 lg:px-8">
              <SectionLabel auto>À lire sur {page.nom_region}</SectionLabel>
              <div className="space-y-3">
                {articles.map((a) => (
                  <Link
                    key={a.slug}
                    to={`/blog/${a.slug}`}
                    className="grid grid-cols-[80px_1fr] gap-4 items-center bg-card border border-nude-poudre/80 rounded-lg p-3 hover:border-or-riche-riche transition-colors"
                  >
                    <div className="h-[60px] rounded overflow-hidden bg-gradient-to-br from-nude-poudre to-champagne">
                      {a.image_couverture_url && (
                        <img
                          src={a.image_couverture_url}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div>
                      {a.categorie_blog && (
                        <span className="inline-block bg-or-riche/15 text-or-riche text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded mb-1">
                          {a.categorie_blog}
                        </span>
                      )}
                      <h3 className="font-serif text-sm md:text-base text-bleu-abysse leading-snug">{a.titre}</h3>
                      <div className="text-[11px] text-gris-cachemire mt-1">
                        {a.temps_lecture ? `${a.temps_lecture} min` : "Lecture"}
                        {a.auteur ? ` · ${a.auteur}` : ""}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        {page.faq && page.faq.length > 0 && (
          <section className="py-10 md:py-14 bg-card">
            <div className="max-w-[1099px] mx-auto px-6 lg:px-8">
              <div className="flex items-center gap-2 mb-5 flex-wrap">
                <span className="text-[10px] uppercase tracking-[0.08em] text-gris-cachemire font-medium">
                  Questions fréquentes
                </span>
              </div>
              <div className="space-y-2.5">
                {page.faq.map((q, i) => (
                  <div
                    key={i}
                    className="bg-secondary/30 border border-nude-poudre/80 rounded-lg p-4"
                  >
                    <h3 className="text-sm font-semibold text-bleu-abysse mb-2">{q.question}</h3>
                    <p className="text-xs md:text-[13px] text-gris-cachemire leading-relaxed">
                      {renderInline(q.reponse)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CITATION LLM */}
        {page.citation_llm && (
          <section className="py-10 md:py-12 bg-[#F0EBE3]">
            <div className="max-w-[1099px] mx-auto px-6 lg:px-8">
              <blockquote className="bg-card border-l-2 border-or-riche rounded-r-lg p-5 md:p-6 italic text-gris-cachemire leading-loose text-sm">
                « {renderInline(page.citation_llm)} »
              </blockquote>
            </div>
          </section>
        )}

        {/* CONTENU SEO BAS */}
        {page.contenu_seo_bas && (
          <section className="py-10 md:py-14 bg-secondary/30">
            <div className="max-w-[1099px] mx-auto px-6 lg:px-8">
              <h2 className="font-serif text-2xl md:text-3xl text-bleu-abysse mb-6">
                Tout savoir sur le mariage en {page.nom_region}
              </h2>
              <div
                className="prose prose-sm md:prose-base max-w-none text-gris-cachemire leading-relaxed
                  prose-headings:font-serif prose-headings:text-bleu-abysse
                  prose-p:text-gris-cachemire prose-p:leading-loose
                  prose-strong:text-bleu-abysse"
                dangerouslySetInnerHTML={{ __html: page.contenu_seo_bas }}
              />
            </div>
          </section>
        )}

        {/* CTA Newsletter */}
        <section className="bg-bleu-abysse py-12 md:py-16">
          <div className="max-w-2xl mx-auto px-6 lg:px-8 text-center">
            <h2 className="font-serif italic text-champagne text-2xl md:text-3xl mb-3">
              Organisez votre mariage en {page.nom_region}
            </h2>
            <p className="text-white/60 text-sm mb-6">
              Recevez notre sélection de prestataires validés par LesNoces
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
              }}
              className="flex gap-2 max-w-md mx-auto flex-col sm:flex-row"
            >
              <input
                type="email"
                placeholder="votre@email.fr"
                className="flex-1 bg-white/10 border border-white/20 text-white rounded px-4 py-3 text-sm placeholder:text-white/40 focus:outline-none focus:border-or-riche-riche"
              />
              <button
                type="submit"
                className="bg-or-riche text-white text-sm font-semibold px-6 py-3 rounded hover:bg-or-riche/90 transition-colors whitespace-nowrap"
              >
                Recevoir <ArrowRight className="inline w-4 h-4 ml-1" />
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}

/* ─── Sous-composants ───────────────────────────────────── */

function ResumeCard({ value, sub, wide }: { value: string; sub: string; wide?: boolean }) {
  return (
    <div
      className={`flex items-start gap-3 p-3.5 px-4 bg-card rounded-lg border border-nude-poudre/80 ${wide ? "md:col-span-2" : ""}`}
    >
      <span className="text-or-riche text-base font-serif italic leading-tight shrink-0">→</span>
      <div>
        <div className="text-sm font-semibold text-bleu-abysse">{value}</div>
        <div className="text-[11px] text-gris-cachemire mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-card border border-nude-poudre/80 rounded-lg p-4 text-center">
      <div className="font-serif text-or-riche text-3xl md:text-4xl">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.08em] text-gris-cachemire font-medium mt-1.5">{label}</div>
    </div>
  );
}

function SectionLabel({
  children,
  auto,
  editorial,
  className = "",
}: {
  children: React.ReactNode;
  auto?: boolean;
  editorial?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 mb-5 flex-wrap ${className}`}>
      <span className="text-[10px] uppercase tracking-[0.08em] text-gris-cachemire font-medium">{children}</span>
    </div>
  );
}

function CategoryPillBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-colors ${
        active
          ? "border border-or-riche text-or-riche bg-or-riche/5"
          : "border border-nude-poudre text-gris-cachemire hover:text-or-riche-riche hover:border-or-riche-riche"
      }`}
    >
      {label}
    </button>
  );
}
