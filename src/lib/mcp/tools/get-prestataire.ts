import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

const PUBLIC_FIELDS =
  "id, slug, nom_commercial, description, description_courte, ville, region, code_postal, prix_depart, prix_max, note_moyenne, nombre_avis, site_web, urls_galerie, photo_principale_url, video_url, tags, champs_specifiques, est_premium, est_verifie, zones_intervention";

export default defineTool({
  name: "get_prestataire",
  title: "Fiche prestataire",
  description: "Renvoie la fiche publique complète d'un prestataire LesNoces par son slug.",
  inputSchema: {
    slug: z.string().min(1).describe("Slug de la fiche (ex: studio-fleuriste-ephemere)"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }, ctx) => {
    const token = ctx.getToken();
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("prestataires")
      .select(PUBLIC_FIELDS)
      .eq("slug", slug)
      .eq("statut", "actif")
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: `Erreur: ${error.message}` }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Fiche introuvable ou non publiée." }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { prestataire: data },
    };
  },
});
