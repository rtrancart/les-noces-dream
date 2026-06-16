import { Helmet } from "react-helmet-async";

/**
 * Inject one or several JSON-LD schemas into <head>.
 *
 * Render via react-helmet-async so Vercel's prerenderer snapshots the
 * <script type="application/ld+json"> tags into static HTML for crawlers.
 *
 * Stack multiple schemas by passing an array; each becomes its own
 * <script> tag (preferred over a single graph for crawler robustness).
 */
export default function JsonLd({
  schema,
}: {
  schema: Record<string, unknown> | Record<string, unknown>[];
}) {
  const list = Array.isArray(schema) ? schema : [schema];
  return (
    <Helmet>
      {list.map((s, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(s)}
        </script>
      ))}
    </Helmet>
  );
}
