import { parseMarkdown, renderInlineHtml } from "@/lib/markdown";

/**
 * Rendu markdown du bloc éditorial d'une page catégorie.
 *
 * Contrairement à MarkdownDescription (utilisé dans les fiches), les niveaux de
 * titre sont conservés tels quels : `##` → H2, `###` → H3, pour respecter la
 * hiérarchie H1 > H2 > H3 attendue par les moteurs sur les pages catégorie.
 */
export default function CategorieEditorial({ source }: { source: string }) {
  const blocks = parseMarkdown(source);

  return (
    <div className="space-y-4 font-sans text-[15px] leading-relaxed text-muted-foreground">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h1":
          case "h2":
            return (
              <h2
                key={i}
                className="font-serif text-xl md:text-2xl text-foreground pt-4"
                dangerouslySetInnerHTML={{ __html: renderInlineHtml(block.text) }}
              />
            );
          case "h3":
            return (
              <h3
                key={i}
                className="font-serif text-lg text-foreground pt-3"
                dangerouslySetInnerHTML={{ __html: renderInlineHtml(block.text) }}
              />
            );
          case "p":
            return (
              <p
                key={i}
                dangerouslySetInnerHTML={{ __html: renderInlineHtml(block.text) }}
              />
            );
          case "quote":
            return (
              <blockquote
                key={i}
                className="border-l-2 border-primary/40 pl-4 italic"
                dangerouslySetInnerHTML={{ __html: renderInlineHtml(block.text) }}
              />
            );
          case "ul":
            return (
              <ul key={i} className="list-disc list-outside pl-5 space-y-2">
                {block.items.map((item, j) => (
                  <li key={j} dangerouslySetInnerHTML={{ __html: renderInlineHtml(item) }} />
                ))}
              </ul>
            );
          case "hr":
            return <hr key={i} className="border-border" />;
          default:
            return null;
        }
      })}
    </div>
  );
}
