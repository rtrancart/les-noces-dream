// Génère un sitemap.xml dynamique pour LesNoces.net
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://lesnoces.net";

const STATIC_URLS = [
  { loc: "/", priority: "1.0", changefreq: "daily" },
  { loc: "/recherche", priority: "0.9", changefreq: "daily" },
  { loc: "/blog", priority: "0.8", changefreq: "weekly" },
  { loc: "/connexion", priority: "0.3", changefreq: "monthly" },
  { loc: "/inscription", priority: "0.3", changefreq: "monthly" },
];

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

    const [prestasRes, articlesRes, regionsRes, categoriesRes, subCategoriesRes] = await Promise.all([
      supabase.from("prestataires").select("slug, updated_at").eq("statut", "actif"),
      supabase.from("articles_blog").select("slug, updated_at, inclure_sitemap, noindex").eq("est_publie", true),
      supabase.from("pages_regions_mariage").select("slug_region, updated_at").eq("est_publiee", true),
      supabase.from("categories").select("id, slug, updated_at").eq("est_active", true).is("parent_id", null),
      supabase.from("categories").select("slug, updated_at, parent_id").eq("est_active", true).not("parent_id", "is", null),
    ]);

    const urls: Array<{ loc: string; lastmod?: string; priority: string; changefreq: string }> = [];

    for (const u of STATIC_URLS) urls.push({ ...u });

    const meresById = new Map<string, { slug: string }>();
    for (const c of categoriesRes.data ?? []) {
      meresById.set((c as any).id, { slug: (c as any).slug });
      urls.push({ loc: `/prestataires/${(c as any).slug}`, lastmod: (c as any).updated_at, priority: "0.7", changefreq: "weekly" });
    }

    for (const sub of subCategoriesRes.data ?? []) {
      const parent = meresById.get((sub as any).parent_id);
      if (!parent) continue;
      urls.push({
        loc: `/prestataires/${parent.slug}/${(sub as any).slug}`,
        lastmod: (sub as any).updated_at,
        priority: "0.6",
        changefreq: "weekly",
      });
    }

    for (const r of regionsRes.data ?? []) {
      urls.push({ loc: `/mariage/${r.slug_region}`, lastmod: r.updated_at, priority: "0.8", changefreq: "monthly" });
    }

    for (const a of articlesRes.data ?? []) {
      if ((a as any).noindex || (a as any).inclure_sitemap === false) continue;
      urls.push({ loc: `/blog/${a.slug}`, lastmod: a.updated_at, priority: "0.6", changefreq: "monthly" });
    }

    for (const p of prestasRes.data ?? []) {
      urls.push({ loc: `/prestataire/${p.slug}`, lastmod: p.updated_at, priority: "0.7", changefreq: "weekly" });
    }


    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls
        .map(
          (u) =>
            `  <url>\n    <loc>${escapeXml(SITE_URL + u.loc)}</loc>\n` +
            (u.lastmod ? `    <lastmod>${u.lastmod.slice(0, 10)}</lastmod>\n` : "") +
            `    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
        )
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
