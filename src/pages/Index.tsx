import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, MapPin, Star, ChevronRight, ArrowRight, Clock, Shield, Award, Users, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import LocationPicker from "@/components/LocationPicker";
import CategoryPicker, { type CategoryOption } from "@/components/CategoryPicker";


/* ─── Types ─────────────────────────────────────────────── */

interface CategoryData {
  id: string;
  nom: string;
  slug: string;
  icone_url: string | null;
  photo_url: string | null;
  prestataire_count: number;
}

interface ProviderData {
  id: string;
  nom_commercial: string;
  slug: string;
  description_courte: string | null;
  ville: string;
  region: string;
  photo_principale_url: string | null;
  note_moyenne: number | null;
  nombre_avis: number | null;
  prix_depart: number | null;
  fin_premium: string | null;
  categorie_nom: string;
}

interface ArticleData {
  id: string;
  titre: string;
  slug: string;
  extrait: string | null;
  image_couverture_url: string | null;
  categorie_blog: string | null;
  created_at: string;
  auteur_prenom: string | null;
}

/* ─── Hook: données accueil ──────────────────────────────── */

function useHomeData() {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [categoryTree, setCategoryTree] = useState<CategoryOption[]>([]);
  const [providers, setProviders] = useState<ProviderData[]>([]);
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const [catRes, prestaRes, artRes] = await Promise.all([
        supabase
          .from("categories")
          .select("id, nom, slug, icone_url, photo_url")
          .is("parent_id", null)
          .eq("est_active", true)
          .order("ordre_affichage")
          .limit(10),
        supabase
          .from("prestataires")
          .select("id, nom_commercial, slug, description_courte, ville, region, photo_principale_url, note_moyenne, nombre_avis, prix_depart, fin_premium, categorie_mere_id")
          .eq("statut", "actif")
          .gte("fin_premium", new Date().toISOString())
          .order("note_moyenne", { ascending: false })
          .limit(5),
        supabase
          .from("articles_blog")
          .select("id, titre, slug, extrait, image_couverture_url, categorie_blog, created_at, auteur_id")
          .eq("est_publie", true)
          .order("created_at", { ascending: false })
          .limit(4),
      ]);

      // Map categories with prestataire count
      if (catRes.data) {
        const catsWithCount: CategoryData[] = [];
        for (const cat of catRes.data) {
          const { count } = await supabase
            .from("prestataires")
            .select("id", { count: "exact", head: true })
            .eq("categorie_mere_id", cat.id)
            .eq("statut", "actif");
          catsWithCount.push({ ...cat, prestataire_count: count ?? 0 });
        }
        setCategories(catsWithCount);
      }

      // Map providers with category name
      if (prestaRes.data && catRes.data) {
        const catMap = new Map(catRes.data.map((c) => [c.id, c.nom]));
        setProviders(
          prestaRes.data.map((p) => ({
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
            fin_premium: (p as any).fin_premium,
            categorie_nom: catMap.get(p.categorie_mere_id as string) ?? "",
          }))
        );
      }

      // Map articles with author name
      if (artRes.data) {
        const authorIds = [...new Set(artRes.data.map((a) => a.auteur_id).filter(Boolean))];
        let authorMap = new Map<string, string>();
        if (authorIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, prenom, nom")
            .in("id", authorIds as string[]);
          if (profiles) {
            authorMap = new Map(profiles.map((p) => [p.id, [p.prenom, p.nom].filter(Boolean).join(" ")]));
          }
        }
        setArticles(
          artRes.data.map((a) => ({
            id: a.id,
            titre: a.titre,
            slug: a.slug,
            extrait: a.extrait,
            image_couverture_url: a.image_couverture_url,
            categorie_blog: a.categorie_blog,
            created_at: a.created_at,
            auteur_prenom: a.auteur_id ? authorMap.get(a.auteur_id) ?? null : null,
          }))
        );
      }

      setLoading(false);
    }
    fetch();
  }, []);

  return { categories, providers, articles, loading };
}

/* ─── Price Helper ───────────────────────────────────────── */

function priceRange(prix: number | null) {
  if (!prix) return "€€";
  if (prix < 1000) return "€";
  if (prix < 3000) return "€€";
  if (prix < 6000) return "€€€";
  return "€€€€";
}

/* ─── Section: Hero ─────────────────────────────────────── */

function HeroSection({ categories }: { categories: CategoryData[] }) {
  const [locationZones, setLocationZones] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const navigate = useNavigate();

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (category) params.set("categorie", category);
    if (locationZones.length > 0) params.set("lieu", locationZones.join(","));
    navigate(`/prestataires?${params.toString()}`);
  };

  return (
    <section className="relative h-[500px] md:h-[600px] overflow-hidden">
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/videos/hero-banner.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-foreground/40" />

      <div className="relative h-full flex flex-col items-center justify-center text-center px-6 lg:px-8">
        <h1 className="text-primary-foreground text-4xl md:text-6xl lg:text-7xl font-medium font-serif leading-tight max-w-[846px] mb-6">
          Les meilleurs prestataires sélectionnés pour vous
        </h1>
        <p className="text-primary-foreground/90 text-lg md:text-xl font-sans mb-10">
          Mariages, fêtes de familles, séminaires, cocktails d'entreprises
        </p>

        {/* Search bar */}
        <div className="bg-card rounded-md shadow-elevated flex flex-col sm:flex-row items-stretch gap-0 p-3 w-full max-w-[768px]">
          {/* Category */}
          <div className="flex items-center gap-3 flex-1 border-b sm:border-b-0 sm:border-r border-border pr-0 sm:pr-3 pb-3 sm:pb-0 h-14">
            <Search className="w-5 h-5 text-muted-foreground shrink-0" />
            <select
              className="flex-1 text-base text-muted-foreground bg-transparent outline-none cursor-pointer font-sans"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Quelle catégorie ?</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div className="flex items-center flex-1 h-14 px-0 sm:px-2 pt-3 sm:pt-0">
            <LocationPicker
              value={locationZones}
              onChange={setLocationZones}
              placeholder="Où ?"
            />
          </div>

          <Button
            onClick={handleSearch}
            className="h-14 px-8 shrink-0 text-base font-medium mt-3 sm:mt-0"
          >
            Rechercher
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ─── Section: Catégories ────────────────────────────────── */

function CategoryCard({ cat }: { cat: CategoryData }) {
  return (
    <Link
      to={`/categories/${cat.slug}`}
      className="relative overflow-hidden rounded-md block group aspect-square"
    >
      {/* Background photo */}
      {cat.photo_url ? (
        <img
          src={cat.photo_url}
          alt={cat.nom}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-muted/30" />
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/50 via-50% to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col items-center text-center">
        <h3 className="text-primary-foreground text-lg md:text-xl font-medium font-serif">
          {cat.nom}
        </h3>
        <p className="text-primary-foreground/80 text-sm font-sans mt-0.5">
          {cat.prestataire_count} prestataires
        </p>
      </div>
    </Link>
  );
}

function CategoriesSection({ categories }: { categories: CategoryData[] }) {
  if (categories.length === 0) return null;

  return (
    <section className="bg-card py-20 md:py-24 px-6 lg:px-8">
      <div className="max-w-[1099px] mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-foreground text-3xl md:text-5xl font-medium font-serif mb-4">
            Nos catégories de prestataires haut de gamme
          </h2>
          <p className="text-muted-foreground text-lg font-sans max-w-xl mx-auto">
            Des prestataires d'exception sélectionnés par LesNoces.net et validés par vous !
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
          {categories.map((cat) => (
            <CategoryCard key={cat.id} cat={cat} />
          ))}
        </div>

        <div className="flex justify-center mt-14">
          <Button asChild size="lg" className="gap-3 h-14 px-8 text-base">
            <Link to="/categories">
              Voir toutes nos catégories de prestataires
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ─── Section: Prestataires en vedette ───────────────────── */

function ProviderCard({ provider }: { provider: ProviderData }) {
  return (
    <div className="bg-card rounded-md shadow-card overflow-hidden flex flex-col">
      {/* Image */}
      <div className="relative h-52 md:h-64 bg-secondary/30 flex items-center justify-center shrink-0">
        {provider.photo_principale_url ? (
          <img
            src={provider.photo_principale_url}
            alt={provider.nom_commercial}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-20 h-20 text-muted-foreground/30">
            <svg viewBox="0 0 88 88" fill="none" className="w-full h-full">
              <rect x="4" y="4" width="80" height="80" rx="4" stroke="currentColor" strokeWidth="2" />
              <circle cx="28" cy="34" r="8" stroke="currentColor" strokeWidth="2" />
              <path d="M4 60l20-20 16 16 12-12 32 20" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
        )}
        {provider.fin_premium && new Date(provider.fin_premium) > new Date() && (
          <span className="absolute top-4 right-4 bg-primary text-primary-foreground text-xs uppercase tracking-wider px-3 py-1.5 rounded-md font-sans font-medium">
            Premium
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-5 md:p-6 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-3">
          <span className="bg-secondary text-destructive text-xs px-3 py-1 rounded-md font-sans">
            {provider.categorie_nom}
          </span>
          <span className="text-primary text-sm font-sans">
            {priceRange(provider.prix_depart)}
          </span>
        </div>

        <h3 className="text-foreground text-xl md:text-2xl font-medium font-serif mb-2">
          {provider.nom_commercial}
        </h3>

        <div className="flex items-center gap-1 mb-2 text-muted-foreground">
          <MapPin className="w-4 h-4 shrink-0" />
          <span className="text-sm font-sans">{provider.ville}, {provider.region}</span>
        </div>

        {provider.description_courte && (
          <p className="text-muted-foreground text-sm font-sans leading-relaxed line-clamp-2 flex-1">
            {provider.description_courte}
          </p>
        )}

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-primary fill-primary" />
            <span className="text-foreground text-sm font-sans">
              {provider.note_moyenne?.toFixed(1) ?? "—"} ({provider.nombre_avis ?? 0})
            </span>
          </div>
          <Link
            to={`/prestataire/${provider.slug}`}
            className="flex items-center gap-1 text-primary text-sm font-sans hover:underline"
          >
            Découvrir
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function FeaturedProviders({ providers }: { providers: ProviderData[] }) {
  if (providers.length === 0) return null;

  return (
    <section className="bg-background py-20 md:py-24 px-6 lg:px-8">
      <div className="max-w-[1099px] mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-foreground text-3xl md:text-5xl font-medium font-serif mb-4">
            Prestataires en vedette
          </h2>
          <p className="text-muted-foreground text-lg font-sans max-w-xl mx-auto">
            Notre sélection exclusive des meilleurs professionnels de l'événementiel haut de gamme
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {providers.slice(0, 3).map((p) => (
            <ProviderCard key={p.id} provider={p} />
          ))}
        </div>
        {providers.length > 3 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8 mt-8 max-w-[720px]">
            {providers.slice(3).map((p) => (
              <ProviderCard key={p.id} provider={p} />
            ))}
          </div>
        )}

        <div className="flex justify-center mt-12">
          <Button asChild size="lg" className="gap-3 h-14 px-8 text-base">
            <Link to="/prestataires">
              Voir tous les prestataires
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ─── Section: Trust ─────────────────────────────────────── */

function TrustSection() {
  const items = [
    { icon: Shield, title: "Curation éditoriale", desc: "Chaque prestataire est validé manuellement par notre équipe d'experts" },
    { icon: Award, title: "Qualité premium", desc: "Seulement les meilleurs professionnels haut de gamme" },
    { icon: Users, title: "+5000 mariages réalisés", desc: "Des couples satisfaits partout en France" },
    { icon: Heart, title: "Accompagnement personnalisé", desc: "Notre équipe vous guide dans vos choix" },
  ];

  return (
    <section className="bg-secondary py-20 md:py-24 px-6 lg:px-8">
      <div className="max-w-[1099px] mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-foreground text-3xl md:text-5xl font-medium font-serif mb-4">
            Pourquoi LesNoces.net ?
          </h2>
          <p className="text-muted-foreground text-lg font-sans">
            La différence qui fait toute la différence
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {items.map((item) => (
            <div key={item.title} className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center mb-5 shrink-0">
                <item.icon className="w-7 h-7 text-primary-foreground" />
              </div>
              <h3 className="text-foreground text-lg md:text-xl font-medium font-serif mb-2">
                {item.title}
              </h3>
              <p className="text-muted-foreground text-sm font-sans">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Section: Blog ──────────────────────────────────────── */

function ArticleCard({ article }: { article: ArticleData }) {
  const dateStr = new Date(article.created_at).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <article className="bg-card rounded-md overflow-hidden flex flex-col shadow-card">
      <div className="relative h-56 md:h-72 bg-secondary/30 flex items-center justify-center shrink-0">
        {article.image_couverture_url ? (
          <img
            src={article.image_couverture_url}
            alt={article.titre}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-20 h-20 text-muted-foreground/30">
            <svg viewBox="0 0 88 88" fill="none" className="w-full h-full">
              <rect x="4" y="4" width="80" height="80" rx="4" stroke="currentColor" strokeWidth="2" />
              <circle cx="28" cy="34" r="8" stroke="currentColor" strokeWidth="2" />
              <path d="M4 60l20-20 16 16 12-12 32 20" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
        )}
        {article.categorie_blog && (
          <span className="absolute top-4 left-4 bg-card/90 text-destructive text-xs uppercase tracking-wider px-3 py-1 rounded-md font-sans">
            {article.categorie_blog}
          </span>
        )}
      </div>

      <div className="p-6 md:p-8 flex flex-col flex-1">
        <div className="flex items-center gap-2 text-muted-foreground text-sm font-sans mb-3 flex-wrap">
          {article.auteur_prenom && <span>{article.auteur_prenom}</span>}
          {article.auteur_prenom && <span>•</span>}
          <span>{dateStr}</span>
          <span>•</span>
          <Clock className="w-3.5 h-3.5" />
          <span>5 min</span>
        </div>

        <h3 className="text-foreground text-xl md:text-2xl font-medium font-serif mb-3 line-clamp-2">
          {article.titre}
        </h3>

        {article.extrait && (
          <p className="text-muted-foreground text-sm md:text-base font-sans leading-relaxed line-clamp-3 flex-1">
            {article.extrait}
          </p>
        )}

        <Link
          to={`/blog/${article.slug}`}
          className="inline-flex items-center gap-2 text-primary text-sm font-sans mt-5 hover:underline"
        >
          Lire l'article
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </article>
  );
}

function BlogSection({ articles }: { articles: ArticleData[] }) {
  if (articles.length === 0) return null;

  return (
    <section className="bg-card py-20 md:py-24 px-6 lg:px-8">
      <div className="max-w-[1099px] mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-foreground text-3xl md:text-5xl font-medium font-serif mb-4">
            Inspirations &amp; Conseils
          </h2>
          <p className="text-muted-foreground text-lg font-sans">
            Découvrez nos articles pour organiser le mariage de vos rêves
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>

        <div className="flex justify-center mt-12">
          <Button asChild variant="outline" size="lg" className="gap-3 h-14 px-8 text-base border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
            <Link to="/blog">
              Voir tous les articles
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ─── Section: Régions ───────────────────────────────────── */

const REGIONS_DATA = [
  { name: "Île-de-France", slug: "ile-de-france" },
  { name: "Provence-Alpes-Côte d'Azur", slug: "provence-alpes-cote-d-azur" },
  { name: "Auvergne-Rhône-Alpes", slug: "auvergne-rhone-alpes" },
  { name: "Nouvelle-Aquitaine", slug: "nouvelle-aquitaine" },
  { name: "Occitanie", slug: "occitanie" },
  { name: "Bretagne", slug: "bretagne" },
];

const MORE_REGIONS = ["Normandie", "Grand Est", "Hauts-de-France", "Pays de la Loire"];

function RegionCard({ region }: { region: { name: string; slug: string } }) {
  return (
    <Link
      to={`/regions/${region.slug}`}
      className="relative overflow-hidden rounded-md block group h-56 md:h-72"
    >
      <div className="absolute inset-0 bg-secondary/30 flex items-center justify-center">
        <MapPin className="w-12 h-12 text-muted-foreground/20" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/40 via-50% to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-champagne" />
          <span className="text-champagne text-sm font-sans">Prestataires</span>
        </div>
        <h3 className="text-primary-foreground text-lg md:text-2xl font-medium font-serif">
          Organiser son mariage en {region.name}
        </h3>
      </div>
    </Link>
  );
}

function RegionalSection() {
  return (
    <section className="bg-card py-20 md:py-24 px-6 lg:px-8">
      <div className="max-w-[1099px] mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-foreground text-3xl md:text-5xl font-medium font-serif mb-4">
            Trouvez vos prestataires par région
          </h2>
          <p className="text-muted-foreground text-lg font-sans">
            Des professionnels d'exception dans toute la France
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {REGIONS_DATA.map((region) => (
            <RegionCard key={region.slug} region={region} />
          ))}
        </div>

        <p className="text-center text-muted-foreground text-sm font-sans mt-8">
          Plus de régions :{" "}
          {MORE_REGIONS.map((r, i) => (
            <span key={r}>
              <Link to={`/regions/${r.toLowerCase().replace(/\s+/g, "-")}`} className="text-primary hover:underline">
                {r}
              </Link>
              {i < MORE_REGIONS.length - 1 && ", "}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

/* ─── Page d'accueil ─────────────────────────────────────── */

export default function Index() {
  const { categories, providers, articles } = useHomeData();

  return (
    <>
      <HeroSection categories={categories} />
      <CategoriesSection categories={categories} />
      <FeaturedProviders providers={providers} />
      <TrustSection />
      <BlogSection articles={articles} />
      <RegionalSection />
    </>
  );
}
