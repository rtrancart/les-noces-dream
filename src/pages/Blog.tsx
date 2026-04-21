import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArticleTile } from "@/components/blog/ArticleTile";
import { Skeleton } from "@/components/ui/skeleton";

interface Article {
  id: string;
  slug: string;
  titre: string;
  extrait: string | null;
  categorie_blog: string | null;
  image_couverture_url: string | null;
  publie_le: string | null;
  auteur?: { prenom: string | null; nom: string | null } | null;
}

const PAGE_SIZE = 9;

export default function Blog() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    document.title = "Inspirations & Conseils — Le Journal | LesNoces.net";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "Le carnet d'une rédaction qui parcourt la France des belles noces — chroniques, carnets de lieux, confidences d'artisans."
      );
    }
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("articles_blog")
        .select(
          "id, slug, titre, extrait, categorie_blog, image_couverture_url, publie_le, auteur:profiles(prenom, nom)"
        )
        .eq("est_publie", true)
        .order("publie_le", { ascending: false, nullsFirst: false });

      setArticles((data as unknown as Article[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    articles.forEach((a) => {
      if (a.categorie_blog) map.set(a.categorie_blog, (map.get(a.categorie_blog) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([slug, count]) => ({ slug, nom: slug, count }));
  }, [articles]);

  const filtered = useMemo(() => {
    if (activeCat === "all") return articles;
    return articles.filter((a) => a.categorie_blog === activeCat);
  }, [articles, activeCat]);

  const featured = filtered[0];
  const secondary = filtered.slice(1, 3);
  const tail = filtered.slice(3, 3 + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(Math.max(0, filtered.length - 3) / PAGE_SIZE));

  const formatDate = (iso?: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const authorName = (a?: Article["auteur"]) => {
    if (!a) return "Rédaction";
    const full = `${a.prenom ?? ""} ${a.nom ?? ""}`.trim();
    return full || "Rédaction";
  };

  return (
    <div className="bg-[#FBF8F3] min-h-screen text-bleu-abysse">
      {/* Masthead */}
      <header className="text-center px-6 md:px-20 pt-20 md:pt-[120px] pb-16 border-b border-border">
        <div className="text-[10px] tracking-[0.5em] uppercase text-gris-cachemire mb-10">
          Le Journal &nbsp;·&nbsp; Volume XII &nbsp;·&nbsp; {new Date().getFullYear()}
        </div>
        <h1 className="font-serif font-normal text-5xl md:text-7xl lg:text-[104px] leading-[0.95] tracking-tight m-0">
          Inspirations <span className="italic">&amp;</span> Conseils
        </h1>
        <p className="max-w-xl mx-auto mt-9 text-[17px] leading-[1.75] text-gris-cachemire font-serif italic">
          Le carnet d'une rédaction qui parcourt la France des belles noces —
          chroniques, carnets de lieux, confidences d'artisans.
        </p>
      </header>

      {/* Catégories */}
      {categories.length > 0 && (
        <nav className="bg-[#FBF8F3] border-b border-border px-6 md:px-20">
          <div className="max-w-[1200px] mx-auto flex items-center gap-10 h-16 overflow-x-auto text-[11px] tracking-[0.2em] uppercase font-medium">
            {[{ slug: "all", nom: "Toutes les rubriques" }, ...categories].map((c) => {
              const active = activeCat === c.slug;
              return (
                <button
                  key={c.slug}
                  onClick={() => {
                    setActiveCat(c.slug);
                    setPage(1);
                  }}
                  className={`whitespace-nowrap py-[22px] -mb-px transition-colors ${
                    active
                      ? "text-bleu-abysse border-b border-bleu-abysse"
                      : "text-gris-cachemire border-b border-transparent hover:text-bleu-abysse"
                  }`}
                >
                  {c.nom}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {loading ? (
        <div className="max-w-[1280px] mx-auto px-6 md:px-20 pt-28 grid md:grid-cols-12 gap-12">
          <Skeleton className="h-[620px] md:col-span-7" />
          <div className="md:col-span-5 space-y-6">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      ) : !featured ? (
        <div className="text-center py-32 px-6">
          <div className="font-serif italic text-2xl text-gris-cachemire">
            Bientôt nos premières chroniques.
          </div>
          <p className="font-serif text-base text-gris-cachemire mt-4 max-w-md mx-auto">
            La rédaction prépare ses prochaines parutions. Revenez très vite découvrir nos premiers récits.
          </p>
        </div>
      ) : (
        <>
          {/* Article vedette */}
          <section className="px-6 md:px-20 pt-20 md:pt-28 max-w-[1280px] mx-auto">
            <div className="grid md:grid-cols-12 gap-10 md:gap-[72px] items-center">
              <div className="md:col-span-7">
                {featured.image_couverture_url ? (
                  <img
                    src={featured.image_couverture_url}
                    alt={featured.titre}
                    className="w-full h-[420px] md:h-[620px] object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-[420px] md:h-[620px]"
                    style={{
                      background: "linear-gradient(140deg, #B3BBA6 0%, #7F8A74 100%)",
                    }}
                    aria-hidden
                  />
                )}
              </div>
              <div className="md:col-span-5">
                <div className="flex items-center gap-3 mb-7 text-[10px] tracking-[0.3em] uppercase text-gris-cachemire font-medium">
                  <span className="w-8 h-px bg-or-riche" />
                  <span className="text-or-riche">En couverture</span>
                  {featured.categorie_blog && (
                    <>
                      <span>·</span>
                      <span>{featured.categorie_blog}</span>
                    </>
                  )}
                </div>
                <h2 className="font-serif font-normal text-4xl md:text-[52px] leading-[1.05] tracking-tight m-0">
                  {featured.titre}
                </h2>
                {featured.extrait && (
                  <p className="text-[17px] leading-[1.75] mt-7 mb-10 font-serif">
                    {featured.extrait}
                  </p>
                )}
                <div className="pt-7 border-t border-border flex flex-wrap items-center gap-3 text-[11px] tracking-[0.2em] uppercase text-gris-cachemire">
                  <span className="text-bleu-abysse font-medium">
                    Par {authorName(featured.auteur)}
                  </span>
                  <span>·</span>
                  <span>{formatDate(featured.publie_le)}</span>
                </div>
                <div className="mt-10">
                  <a
                    href={`/blog/${featured.slug}`}
                    className="font-serif text-sm italic text-bleu-abysse border-b border-or-riche pb-1"
                  >
                    Lire la chronique →
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* Articles secondaires */}
          {secondary.length > 0 && (
            <section className="px-6 md:px-20 pt-24 md:pt-[120px] max-w-[1280px] mx-auto grid md:grid-cols-2 gap-10 md:gap-[72px]">
              {secondary.map((a) => (
                <ArticleTile
                  key={a.id}
                  article={{
                    slug: a.slug,
                    titre: a.titre,
                    extrait: a.extrait,
                    categorie_blog: a.categorie_blog,
                    image_couverture_url: a.image_couverture_url,
                    auteur: authorName(a.auteur),
                  }}
                />
              ))}
            </section>
          )}

          {/* Ornement */}
          {tail.length > 0 && (
            <>
              <div className="px-6 md:px-20 pt-32 md:pt-[140px] pb-16 text-center">
                <div className="flex items-center justify-center gap-5 mb-6 text-gris-cachemire">
                  <span className="w-10 h-px bg-border" />
                  <span className="text-[11px] tracking-[0.3em] uppercase">Chroniques</span>
                  <span className="w-10 h-px bg-border" />
                </div>
                <h2 className="font-serif font-normal italic text-4xl md:text-5xl tracking-tight m-0">
                  Récits &amp; réflexions
                </h2>
              </div>

              {/* Grille 3×2 */}
              <section className="px-6 md:px-20 pb-10 max-w-[1280px] mx-auto grid md:grid-cols-3 gap-10 md:gap-14">
                {tail.map((a) => (
                  <ArticleTile
                    key={a.id}
                    size="compact"
                    article={{
                      slug: a.slug,
                      titre: a.titre,
                      extrait: a.extrait,
                      categorie_blog: a.categorie_blog,
                      image_couverture_url: a.image_couverture_url,
                      auteur: authorName(a.auteur),
                    }}
                  />
                ))}
              </section>
            </>
          )}

          {/* Palmarès */}
          {articles.length >= 3 && (
            <section className="px-6 md:px-20 pt-24 md:pt-[120px] pb-20 max-w-[1100px] mx-auto">
              <div className="grid md:grid-cols-[280px_1fr] gap-12 md:gap-20 items-start">
                <div>
                  <div className="text-[10px] tracking-[0.4em] uppercase text-gris-cachemire mb-5">
                    Palmarès
                  </div>
                  <h3 className="font-serif font-normal text-3xl md:text-4xl tracking-tight leading-tight m-0">
                    Les plus lus
                    <br />
                    <span className="italic">cette saison</span>
                  </h3>
                  <p className="text-[13px] text-gris-cachemire mt-5 leading-[1.7]">
                    Mis à jour chaque semaine par la rédaction.
                  </p>
                </div>
                <ol className="list-none p-0 m-0">
                  {articles.slice(0, 5).map((a, i) => (
                    <li
                      key={a.id}
                      className={`grid grid-cols-[44px_1fr_auto] gap-6 items-center py-5 ${
                        i === 0 ? "border-t border-bleu-abysse" : "border-t border-border"
                      } ${i === 4 ? "border-b border-bleu-abysse" : ""}`}
                    >
                      <span className="font-serif text-[22px] italic text-or-riche tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <a
                        href={`/blog/${a.slug}`}
                        className="font-serif text-lg md:text-[19px] font-normal leading-snug text-bleu-abysse hover:text-or-riche transition-colors"
                      >
                        {a.titre}
                      </a>
                      <span className="text-[11px] text-gris-cachemire tracking-[0.15em] uppercase">
                        {6 + i} min
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 md:px-20 pb-28 max-w-[1280px] mx-auto text-center">
              <div className="inline-flex items-center gap-7 font-serif">
                <span className="text-[13px] text-gris-cachemire tracking-[0.2em] uppercase font-sans">
                  Page
                </span>
                {Array.from({ length: Math.min(totalPages, 4) }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`text-xl pb-1 ${
                      p === page
                        ? "text-bleu-abysse italic border-b border-or-riche"
                        : "text-gris-cachemire"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                {totalPages > 4 && (
                  <>
                    <span className="text-xl text-gris-cachemire">…</span>
                    <button
                      onClick={() => setPage(totalPages)}
                      className={`text-xl pb-1 ${
                        page === totalPages
                          ? "text-bleu-abysse italic border-b border-or-riche"
                          : "text-gris-cachemire"
                      }`}
                    >
                      {totalPages}
                    </button>
                  </>
                )}
                {page < totalPages && (
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="text-[13px] text-bleu-abysse tracking-[0.2em] uppercase font-sans"
                  >
                    Suivante →
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
