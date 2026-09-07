// Réception des sessions de consultation de fiches prestataires.
//
// Appelée par `navigator.sendBeacon` en fin de session : requête POST unique,
// corps en texte brut (le beacon n'autorise pas d'en-tête personnalisé).
// La contrainte d'unicité (session_id, prestataire_id) neutralise les doublons.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clampInt(value: unknown, min: number, max: number): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const raw = await req.text();
    const body = JSON.parse(raw || "{}") as Record<string, unknown>;

    const sessionId = String(body.session_id ?? "");
    const prestataireId = String(body.prestataire_id ?? "");
    if (!UUID_RE.test(sessionId) || !UUID_RE.test(prestataireId)) {
      return new Response(JSON.stringify({ error: "invalid_ids" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dureeSeconds = clampInt(body.duree_seconds, 0, 24 * 3600);
    const startedAt =
      typeof body.started_at === "string" && !Number.isNaN(Date.parse(body.started_at))
        ? body.started_at
        : new Date().toISOString();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { error } = await supabase.from("sessions_fiche").insert({
      session_id: sessionId,
      prestataire_id: prestataireId,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      duree_seconds: dureeSeconds,
      rebond: typeof body.rebond === "boolean" ? body.rebond : null,
      user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      referrer: typeof body.referrer === "string" ? body.referrer.slice(0, 500) : null,
    });

    // 23505 = doublon de beacon : réponse normale, rien à signaler.
    if (error && error.code !== "23505") {
      console.error("insert-session-fiche", error.message);
      return new Response(JSON.stringify({ error: "insert_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("insert-session-fiche", e instanceof Error ? e.message : String(e));
    return new Response(JSON.stringify({ error: "bad_request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
