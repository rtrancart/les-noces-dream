import { parseMarkdown, renderInlineHtml } from "@/lib/markdown";
import { cn } from "@/lib/utils";

/**
 * Rendu markdown safe (échappe le HTML brut) pour les descriptions longues
 * des prestataires. Supporte ##/### intertitres, **gras**, *italique*,
 * listes, citations et paragraphes.
 */
export default function MarkdownDescription({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const blocks = parseMarkdown(source);

  return (
    <div className={cn("text-sm text-foreground leading-relaxed space-y-4", className)}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h1":
            return (
              <h3
                key={i}
                className="font-serif text-xl font-semibold text-foreground mt-4"
                dangerouslySetInnerHTML={{ __html: renderInlineHtml(block.text) }}
              />
            );
          case "h2":
            return (
              <h3
                key={i}
                className="font-serif text-lg font-semibold text-foreground mt-4"
                dangerouslySetInnerHTML={{ __html: renderInlineHtml(block.text) }}
              />
            );
          case "h3":
            return (
              <h4
                key={i}
                className="font-sans text-base font-semibold text-foreground mt-3"
                dangerouslySetInnerHTML={{ __html: renderInlineHtml(block.text) }}
              />
            );
          case "p":
            return (
              <p
                key={i}
                className="whitespace-pre-line"
                dangerouslySetInnerHTML={{ __html: renderInlineHtml(block.text) }}
              />
            );
          case "quote":
            return (
              <blockquote
                key={i}
                className="border-l-2 border-primary/40 pl-4 italic text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: renderInlineHtml(block.text) }}
              />
            );
          case "ul":
            return (
              <ul key={i} className="list-disc list-outside pl-5 space-y-1">
                {block.items.map((item, j) => (
                  <li
                    key={j}
                    dangerouslySetInnerHTML={{ __html: renderInlineHtml(item) }}
                  />
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
