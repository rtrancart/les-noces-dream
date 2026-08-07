// brevo-maintenance — utilitaire temporaire admin-only : inspection et nettoyage
// de contacts/listes côté Brevo pendant la mise au point de la synchro.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { brevoFetch, BrevoError, BREVO_ERROR_LABELS } from "../_shared/brevo-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const FAST = { retries: 0, timeoutMs: 8_000 };

function describeError(err: unknown): string {
  if (err instanceof BrevoError) {
    return `${BREVO_ERROR_LABELS[err.kind]}${err.status ? ` (HTTP ${err.status})` : ""} : ${err.message}`;
  }
  return err instanceof Error ? err.message : String(err);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, message: "Non autorisé" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ ok: false, message: "Non autorisé" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerRoles } = await adminClient
      .from("user_roles").select("role").eq("user_id", caller.id);
    const roles = (callerRoles ?? []).map((r: { role: string }) => r.role);
    if (!roles.includes("admin") && !roles.includes("super_admin")) {
      return json({ ok: false, message: "Accès refusé : rôle admin requis" }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as { action?: string; email?: string };

    switch (body.action) {
      case "contacts": {
        const res = await brevoFetch(
          "/contacts?limit=20&offset=0&sort=desc",
          { method: "GET" },
          FAST,
        );
        return json({ ok: true, res });
      }
      case "lists": {
        const res = await brevoFetch("/contacts/lists?limit=50&offset=0", { method: "GET" }, FAST);
        return json({ ok: true, res });
      }
      case "contact": {
        const res = await brevoFetch(
          `/contacts/${encodeURIComponent(body.email ?? "")}`,
          { method: "GET" },
          FAST,
        );
        return json({ ok: true, res });
      }
      case "delete_contact": {
        await brevoFetch(
          `/contacts/${encodeURIComponent(body.email ?? "")}`,
          { method: "DELETE" },
          FAST,
        );
        return json({ ok: true, supprime: true });
      }
      default:
        return json({ ok: false, message: "action inconnue" }, 400);
    }
  } catch (err) {
    return json({ ok: false, message: describeError(err) }, 200);
  }
});
