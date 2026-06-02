import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SeoHead from "@/components/SeoHead";
import { parseMarkdown, renderInlineHtml } from "@/lib/markdown";
import NotFound from "./NotFound";

type PageRow = {
  titre: string;
  slug: string;
  meta_title: string | null;
  meta_description: string | null;
  contenu: string | null;
};

export default function PageContenu() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<PageRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    supabase
      .from("pages_contenu")
      .select("titre, slug, meta_title, meta_description, contenu")
      .eq("slug", slug)
      .eq("est_publiee", true)
      .maybeSingle()
      .then(({ data }) => {
        setPage(data as PageRow | null);
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20">
        <div className="h-8 w-2/3 animate-pulse rounded bg-muted/30" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded bg-muted/20" />
          ))}
        </div>
      </div>
    );
  }

  if (!page) return <NotFound />;

  const blocks = parseMarkdown(page.contenu ?? "");

  return (
    <>
      <SeoHead
        title={page.meta_title ?? `${page.titre} | LesNoces.net`}
        description={page.meta_description ?? page.titre}
        canonicalUrl={`/${page.slug}`}
      />
      <article className="max-w-3xl mx-auto px-6 py-16 md:py-20">
        <h1 className="font-serif text-4xl md:text-5xl text-bleu-abysse mb-12">
          {page.titre}
        </h1>
        <div className="space-y-1">
          {blocks.map((b, i) => {
            if (b.type === "hr") return <hr key={i} className="my-10 border-border" />;
            if (b.type === "h1")
              return (
                <h2 key={i} className="font-serif text-3xl text-bleu-abysse mt-10 mb-4">
                  {b.text}
                </h2>
              );
            if (b.type === "h2")
              return (
                <h2 key={i} className="font-serif text-2xl text-bleu-abysse mt-10 mb-4">
                  {b.text}
                </h2>
              );
            if (b.type === "h3")
              return (
                <h3 key={i} className="font-serif text-xl text-bleu-abysse mt-6 mb-3">
                  {b.text}
                </h3>
              );
            if (b.type === "quote")
              return (
                <blockquote
                  key={i}
                  className="my-6 border-l-2 border-or-riche pl-4 italic text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: renderInlineHtml(b.text) }}
                />
              );
            if (b.type === "ul")
              return (
                <ul key={i} className="list-disc pl-6 my-4 space-y-2 font-sans text-base text-foreground">
                  {b.items.map((it, j) => (
                    <li key={j} dangerouslySetInnerHTML={{ __html: renderInlineHtml(it) }} />
                  ))}
                </ul>
              );
            return (
              <p
                key={i}
                className="font-sans text-base leading-relaxed text-foreground my-3"
                dangerouslySetInnerHTML={{ __html: renderInlineHtml(b.text) }}
              />
            );
          })}
        </div>
      </article>
    </>
  );
}
