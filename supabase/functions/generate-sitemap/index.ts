// Génère un sitemap.xml dynamique pour LesNoces.net.
// Le recensement des pages indexables est mutualisé avec la réconciliation de
// pré-rendu : voir ../_shared/pages-indexables.ts (aucun filtre dupliqué ici).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  listerPagesIndexables,
  trierPages,
  SITEMAP_HINTS,
} from "../_shared/pages-indexables.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Domaine public piloté par secret — change selon environnement (preview / prod)
// sans modification de code. Fallback prod uniquement si le secret est absent.
const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://lesnoces.net";

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const pages = trierPages(await listerPagesIndexables(supabase));

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      pages
        .map((p) => {
          const hint = SITEMAP_HINTS[p.page_type] ?? { priority: "0.5", changefreq: "monthly" };
          return (
            `  <url>\n    <loc>${escapeXml(SITE_URL.replace(/\/$/, "") + p.url_path)}</loc>\n` +
            (p.lastmod ? `    <lastmod>${String(p.lastmod).slice(0, 10)}</lastmod>\n` : "") +
            `    <changefreq>${hint.changefreq}</changefreq>\n    <priority>${hint.priority}</priority>\n  </url>`
          );
        })
        .join("\n") +
      `\n</urlset>\n`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return new Response(`Sitemap error: ${(e as Error).message}`, {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});
