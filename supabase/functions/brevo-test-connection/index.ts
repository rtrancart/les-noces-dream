// brevo-test-connection — vérifie que la clé BREVO_API_KEY est valide
// et que les échanges avec l'API Brevo aboutissent. Lecture seule.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getBrevoAccount,
  BrevoError,
  BREVO_ERROR_LABELS,
} from "../_shared/brevo-client.ts";

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
    const account = await getBrevoAccount({ retries: 0, timeoutMs: 5_000 });

    return json({
      ok: true,
      latence_ms: Date.now() - started,
      compte: {
        email: account.email ?? null,
        companyName: account.companyName ?? null,
        plan: Array.isArray(account.plan) ? account.plan : [],
      },
    });
  } catch (err) {
    if (err instanceof BrevoError) {
      console.error("[brevo-test-connection] échec", { kind: err.kind, status: err.status });
      return json({
        ok: false,
        kind: err.kind,
        status: err.status,
        motif: BREVO_ERROR_LABELS[err.kind],
        message: err.message,
        retryAfterSeconds: err.retryAfterSeconds,
      });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[brevo-test-connection] erreur inattendue", message);
    return json({ ok: false, kind: "unavailable", motif: "Erreur inattendue", message }, 500);
  }
});
