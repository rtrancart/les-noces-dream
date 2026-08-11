// pennylane-test-connection — vérifie que PENNYLANE_API_TOKEN est valide
// et que les échanges avec l'API Pennylane aboutissent. Lecture seule.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  pingPennylane,
  PennylaneError,
  PENNYLANE_ERROR_LABELS,
} from "../_shared/pennylane-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, kind: "forbidden", message: "Non autorisé" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ ok: false, kind: "forbidden", message: "Non autorisé" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const roles = (callerRoles ?? []).map((r: { role: string }) => r.role);
    if (!roles.includes("admin") && !roles.includes("super_admin")) {
      return json({ ok: false, kind: "forbidden", message: "Accès refusé : rôle admin requis" }, 403);
    }

    // Échec rapide : aucun retry, timeout court — c'est un test interactif.
    const started = Date.now();
    const res = await pingPennylane({ retries: 0, timeoutMs: 8_000 });

    return json({
      ok: true,
      latence_ms: Date.now() - started,
      lecture_clients_ok: Array.isArray(res?.items),
      nb_clients_echantillon: res?.items?.length ?? 0,
    });
  } catch (err) {
    if (err instanceof PennylaneError) {
      console.error("[pennylane-test-connection] échec", { kind: err.kind, status: err.status });
      return json({
        ok: false,
        kind: err.kind,
        status: err.status,
        motif: PENNYLANE_ERROR_LABELS[err.kind],
        message: err.message,
        retryAfterSeconds: err.retryAfterSeconds,
      });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[pennylane-test-connection] erreur inattendue", message);
    return json({ ok: false, kind: "unavailable", motif: "Erreur inattendue", message }, 500);
  }
});
