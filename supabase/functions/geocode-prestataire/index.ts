import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  prestataire_id: z.string().uuid().optional(),
  backfill: z.boolean().optional(),
});

async function geocode(
  address: string,
  city: string,
  postalCode: string | null,
  region: string
): Promise<{ lat: number; lng: number } | null> {
  const query = [address, postalCode, city, region, "France"]
    .filter(Boolean)
    .join(", ");

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=fr`;

  const res = await fetch(url, {
    headers: { "User-Agent": "LesNoces.net/1.0 (contact@lesnoces.net)" },
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (!data || data.length === 0) {
    // Fallback: try with just city + postal code
    const fallbackQuery = [postalCode, city, "France"].filter(Boolean).join(", ");
    const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallbackQuery)}&limit=1&countrycodes=fr`;
    const fallbackRes = await fetch(fallbackUrl, {
      headers: { "User-Agent": "LesNoces.net/1.0 (contact@lesnoces.net)" },
    });
    if (!fallbackRes.ok) return null;
    const fallbackData = await fallbackRes.json();
    if (!fallbackData || fallbackData.length === 0) return null;
    return { lat: parseFloat(fallbackData[0].lat), lng: parseFloat(fallbackData[0].lon) };
  }

  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { prestataire_id, backfill } = parsed.data;
    const results: { id: string; nom: string; success: boolean; coords?: { lat: number; lng: number } }[] = [];

    // Build query for providers to geocode
    let query = supabase
      .from("prestataires")
      .select("id, nom_commercial, adresse, ville, code_postal, region, latitude, longitude");

    if (prestataire_id) {
      query = query.eq("id", prestataire_id);
    } else if (backfill) {
      // Only geocode providers missing coordinates
      query = query.or("latitude.is.null,longitude.is.null");
    } else {
      return new Response(
        JSON.stringify({ error: "Provide prestataire_id or backfill: true" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: providers, error: fetchError } = await query;
    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);

    for (const p of providers || []) {
      // Respect Nominatim rate limit: 1 request per second
      await new Promise((r) => setTimeout(r, 1100));

      const coords = await geocode(
        p.adresse || "",
        p.ville,
        p.code_postal,
        p.region
      );

      if (coords) {
        const { error: updateError } = await supabase
          .from("prestataires")
          .update({ latitude: coords.lat, longitude: coords.lng })
          .eq("id", p.id);

        results.push({
          id: p.id,
          nom: p.nom_commercial,
          success: !updateError,
          coords,
        });
      } else {
        results.push({ id: p.id, nom: p.nom_commercial, success: false });
      }
    }

    return new Response(
      JSON.stringify({ geocoded: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Geocoding error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
