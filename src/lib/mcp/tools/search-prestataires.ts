import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

const PUBLIC_FIELDS =
  "id, slug, nom_commercial, description_courte, ville, region, prix_depart, prix_max, note_moyenne, nombre_avis, est_premium, est_verifie, photo_principale_url";

function client(ctx: ToolContext) {
  const token = ctx.getToken();
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "search_prestataires",
  title: "Rechercher des prestataires",
  description:
    "Recherche des prestataires mariage LesNoces actifs. Filtres optionnels : mot-clé (nom, description), ville, région, catégorie (slug).",
  inputSchema: {
    query: z.string().optional().describe("Mot-clé libre (nom commercial, description)"),
    ville: z.string().optional().describe("Ville (match exact insensible à la casse)"),
    region: z.string().optional().describe("Région (match exact insensible à la casse)"),
    categorie_slug: z.string().optional().describe("Slug d'une catégorie (mère ou fille)"),
    limit: z.number().int().min(1).max(50).default(10),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, ville, region, categorie_slug, limit }, ctx) => {
    const supabase = client(ctx);

    let categorieIds: string[] | null = null;
    if (categorie_slug) {
      const { data: cats } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", categorie_slug);
      categorieIds = (cats ?? []).map((c: { id: string }) => c.id);
      if (categorieIds.length === 0) {
        return { content: [{ type: "text", text: "Aucun résultat (catégorie inconnue)." }], structuredContent: { items: [] } };
      }
    }

    let q = supabase.from("prestataires").select(PUBLIC_FIELDS).eq("statut", "actif").limit(limit);
    if (query) q = q.or(`nom_commercial.ilike.%${query}%,description_courte.ilike.%${query}%,description.ilike.%${query}%`);
    if (ville) q = q.ilike("ville", ville);
    if (region) q = q.ilike("region", region);
    if (categorieIds) q = q.or(
      categorieIds.map((id) => `categorie_mere_id.eq.${id},categorie_fille_id.eq.${id}`).join(","),
    );

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Erreur: ${error.message}` }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { items: data ?? [] },
    };
  },
});
