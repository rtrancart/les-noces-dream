import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ArticleTile } from "@/components/blog/ArticleTile";
import { parseMarkdown, renderInlineHtml } from "@/lib/markdown";

interface Article {
  id: string;
  slug: string;
  titre: string;
  extrait: string | null;
  contenu: string | null;
  categorie_blog: string | null;
  image_couverture_url: string | null;
  publie_le: string | null;
  meta_description: string | null;
  meta_title: string | null;
  tags: string[] | null;
  auteur?: { prenom: string | null; nom: string | null; avatar_url: string | null } | null;
}

const SHARE_LINKS = ["Copier le lien", "Envoyer par email", "Instagram", "Pinterest"];

export default function BlogArticle() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [related, setRelated] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!slug) return;
      setLoading(true);

      const { data } = await supabase
        .from("articles_blog")
        .select(
          "id, slug, titre, extrait, contenu, categorie_blog, image_couverture_url, publie_le, meta_description, meta_title, tags, auteur:profiles(prenom, nom, avatar_url)"
        )
        .eq("slug", slug)
        .eq("est_publie", true)
        .maybeSingle();

      const art = (data as unknown as Article) ?? null;
      setArticle(art);

      if (art) {
        document.title = art.meta_title || `${art.titre} | LesNoces.net`;
        const meta = document.querySelector('meta[name="description"]');
        if (meta && (art.meta_description || art.extrait)) {
          meta.setAttribute("content", art.meta_description || art.extrait || "");
        }

        const { data: rel } = await supabase
          .from("articles_blog")
          .select(
            "id, slug, titre, extrait, contenu, categorie_blog, image_couverture_url, publie_le, meta_description, meta_title, tags, auteur:profiles(prenom, nom, avatar_url)"
          )
          .eq("est_publie", true)
          .neq("id", art.id)
          .order("publie_le", { ascending: false, nullsFirst: false })
          .limit(3);

        setRelated((rel as unknown as Article[]) ?? []);
      }

      setLoading(false);
    }
    load();
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [slug]);

  const blocks = useMemo(() => {
    if (!article?.contenu) return [];
    return parseMarkdown(article.contenu);
  }, [article?.contenu]);

  const slugify = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

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

  if (loading) {
    return (
      <div className="bg-[#FBF8F3] min-h-screen px-6 md:px-20 py-20 max-w-[1280px] mx-auto">
        <Skeleton className="h-8 w-48 mb-10" />
        <Skeleton className="h-20 w-3/4 mb-6" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="bg-[#FBF8F3] min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="font-serif text-4xl text-bleu-abysse mb-4">Article introuvable</h1>
          <Link to="/blog" className="font-serif italic text-or-riche border-b border-or-riche pb-1">
            Retour au journal →
          </Link>
        </div>
      </div>
    );
  }

  const sections = blocks
    .filter((b) => b.type === "h2")
    .map((b) => (b as { type: "h2"; text: string }).text);

  // Premier paragraphe pour le drop cap (avant tout titre)
  const firstParaIdx = blocks.findIndex((b) => b.type === "p");
  const firstPara = firstParaIdx >= 0 ? (blocks[firstParaIdx] as { text: string }).text : null;

  // Premier blockquote du contenu pour la pull-quote (sinon fallback)
  const firstQuote = blocks.find((b) => b.type === "quote") as { text: string } | undefined;

  return (
    <div className="bg-[#FBF8F3] min-h-screen text-bleu-abysse">
      {/* Breadcrumb */}
      <div className="px-6 md:px-20 pt-10 max-w-[1280px] mx-auto text-[10px] tracking-[0.3em] uppercase text-gris-cachemire">
        <Link to="/blog" className="hover:text-bleu-abysse">Le Journal</Link>
        {article.categorie_blog && (
          <>
            <span className="mx-3 text-or-riche">/</span>
            <span>{article.categorie_blog}</span>
          </>
        )}
      </div>

      {/* Hero split 60/40 */}
      <header className="px-6 md:px-20 pt-14 pb-20 max-w-[1280px] mx-auto grid md:grid-cols-[1.2fr_1fr] gap-10 md:gap-[72px] items-center">
        <div>
          {article.categorie_blog && (
            <div className="flex items-center gap-3 mb-8 text-[10px] tracking-[0.3em] uppercase text-gris-cachemire">
              <span className="w-8 h-px bg-terracotta" />
              <span>{article.categorie_blog}</span>
            </div>
          )}
          <h1 className="font-serif font-normal text-4xl md:text-[60px] leading-[1.05] tracking-tight m-0">
            {article.titre}
          </h1>
          {article.extrait && (
            <p className="font-serif italic text-lg md:text-[19px] leading-[1.7] text-gris-cachemire mt-7 max-w-[560px]">
              {article.extrait}
            </p>
          )}
          <div className="mt-10 pt-6 border-t border-border text-[10px] tracking-[0.3em] uppercase text-gris-cachemire flex flex-wrap gap-4">
            <span className="text-bleu-abysse font-medium">Par {authorName(article.auteur)}</span>
            <span>·</span>
            <span>{formatDate(article.publie_le)}</span>
          </div>
        </div>
        <div>
          {article.image_couverture_url ? (
            <img
              src={article.image_couverture_url}
              alt={article.titre}
              className="w-full h-[320px] md:h-[520px] object-cover"
            />
          ) : (
            <div
              className="w-full h-[320px] md:h-[520px]"
              style={{ background: "linear-gradient(140deg, #A86E6B 0%, #7A3F3E 100%)" }}
              aria-hidden
            />
          )}
        </div>
      </header>

      {/* Corps + sidebar */}
      <div className="max-w-[1280px] mx-auto grid md:grid-cols-[1fr_320px] gap-12 md:gap-24 px-6 md:px-20 pt-10 pb-20">
        <article className="max-w-[680px]">
          {blocks.length === 0 ? (
            <p className="font-serif text-lg leading-[1.85] text-gris-cachemire italic">
              Le contenu de cette chronique sera bientôt disponible.
            </p>
          ) : (
            <>
              {blocks.map((b, i) => {
                if (b.type === "h2") {
                  return (
                    <h2
                      key={i}
                      id={slugify(b.text)}
                      className="font-serif font-normal italic text-3xl md:text-[34px] leading-tight tracking-tight mt-16 mb-6 scroll-mt-24"
                    >
                      {b.text}
                    </h2>
                  );
                }
                if (b.type === "h3") {
                  return (
                    <h3
                      key={i}
                      className="font-serif font-normal text-xl md:text-[22px] leading-tight tracking-tight mt-10 mb-4 text-bleu-abysse"
                    >
                      {b.text}
                    </h3>
                  );
                }
                if (b.type === "quote") {
                  return (
                    <blockquote key={i} className="my-12 px-10 border-l border-terracotta">
                      <div
                        className="font-serif italic text-xl md:text-[22px] leading-[1.5] tracking-tight"
                        dangerouslySetInnerHTML={{ __html: renderInlineHtml(b.text) }}
                      />
                    </blockquote>
                  );
                }
                if (b.type === "ul") {
                  return (
                    <ul key={i} className="list-none p-0 my-6 flex flex-col gap-3">
                      {b.items.map((it, j) => (
                        <li
                          key={j}
                          className="font-serif text-lg leading-[1.7] grid grid-cols-[14px_1fr] gap-3"
                        >
                          <span className="text-or-riche pt-2.5 text-[8px]">◆</span>
                          <span dangerouslySetInnerHTML={{ __html: renderInlineHtml(it) }} />
                        </li>
                      ))}
                    </ul>
                  );
                }
                // Paragraphe : drop cap sur le tout premier
                if (i === firstParaIdx && firstPara) {
                  return (
                    <p key={i} className="font-serif font-normal text-xl leading-[1.75] m-0">
                      <span className="font-serif text-7xl md:text-[84px] font-normal text-terracotta float-left leading-[0.85] pr-4 pt-2">
                        {firstPara.charAt(0)}
                      </span>
                      <span dangerouslySetInnerHTML={{ __html: renderInlineHtml(firstPara.slice(1)) }} />
                    </p>
                  );
                }
                return (
                  <p
                    key={i}
                    className="font-serif text-lg leading-[1.85] mt-5 mb-0"
                    dangerouslySetInnerHTML={{ __html: renderInlineHtml(b.text) }}
                  />
                );
              })}

              {/* Pull quote (sur citation extraite ou extrait) */}
              {(firstQuote || article.extrait) && (
                <blockquote className="my-16 px-12 border-l border-terracotta">
                  <div className="font-serif italic text-2xl md:text-[26px] leading-[1.35] tracking-tight">
                    « {firstQuote?.text ?? article.extrait?.slice(0, 140)} »
                  </div>
                  <div className="mt-5 text-[10px] tracking-[0.3em] uppercase text-gris-cachemire">
                    {authorName(article.auteur)}
                  </div>
                </blockquote>
              )}

              {/* Signature fin */}
              <div className="mt-24 pt-10 border-t border-border text-center">
                <div className="font-serif text-base italic text-terracotta mb-6">✦</div>
                <div className="text-[10px] tracking-[0.4em] uppercase text-gris-cachemire">
                  — Fin de la chronique —
                </div>
              </div>
            </>
          )}
        </article>

        {/* Sidebar sticky */}
        <aside className="hidden md:block">
          <div className="sticky top-24 flex flex-col gap-12">
            {/* Sommaire */}
            {sections.length > 0 && (
              <section>
                <div className="text-[10px] tracking-[0.4em] uppercase text-gris-cachemire mb-5">
                  Sommaire
                </div>
                <ol className="list-none p-0 m-0 flex flex-col gap-3.5">
                  {sections.map((s, i) => (
                    <li
                      key={i}
                      className={`font-serif text-sm leading-tight grid grid-cols-[24px_1fr] gap-2 ${
                        i === 0 ? "text-bleu-abysse italic" : "text-gris-cachemire"
                      }`}
                    >
                      <span className={`font-sans text-[10px] pt-1 ${i === 0 ? "text-terracotta" : "text-gris-cachemire"}`}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <a href={`#${slugify(s)}`} className="hover:text-bleu-abysse transition-colors">
                        {s}
                      </a>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Partage */}
            <section>
              <div className="text-[10px] tracking-[0.4em] uppercase text-gris-cachemire mb-5">
                Partager
              </div>
              <div className="flex flex-col">
                {SHARE_LINKS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => {
                      if (l === "Copier le lien") {
                        navigator.clipboard?.writeText(window.location.href);
                      }
                    }}
                    className="font-serif text-[13px] text-bleu-abysse text-left border-b border-border py-3 hover:text-terracotta transition-colors"
                  >
                    {l}
                  </button>
                ))}
              </div>
            </section>

            {/* Tags */}
            {article.tags && article.tags.length > 0 && (
              <section>
                <div className="text-[10px] tracking-[0.4em] uppercase text-or-riche mb-5">
                  Mots-clés
                </div>
                <div className="flex flex-wrap gap-2">
                  {article.tags.map((t) => (
                    <span key={t} className="font-serif text-[13px] italic text-bleu-abysse border-b border-border pb-0.5">
                      {t}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Auteur */}
            <section className="pt-8 border-t border-border">
              <div className="font-serif text-[15px] text-bleu-abysse">
                {authorName(article.auteur)}
              </div>
              <div className="text-[10px] text-gris-cachemire mt-0.5 tracking-[0.1em] uppercase">
                Rédaction
              </div>
            </section>
          </div>
        </aside>
      </div>

      {/* À lire ensuite */}
      {related.length > 0 && (
        <section className="px-6 md:px-20 py-24 md:py-[100px] border-t border-border">
          <div className="max-w-[1280px] mx-auto">
            <div className="mb-14">
              <div className="text-[10px] tracking-[0.4em] uppercase text-gris-cachemire mb-4">
                Pour poursuivre
              </div>
              <h2 className="font-serif font-normal italic text-4xl md:text-[42px] tracking-tight m-0">
                À lire ensuite
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-10 md:gap-14">
              {related.map((a) => (
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
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
