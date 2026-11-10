import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const TIMEOUT_MS = 120_000;

const Body = z.object({
  provider: z.enum(["mistral", "anthropic"]),
  model: z.string().min(1).max(100),
  temperature: z.number().min(0).max(2).default(0.3),
  system: z.string().max(100_000).default(""),
  message: z.string().min(1).max(100_000),
  prompt_label: z.enum(["A", "B", "C"]).nullable().optional(),
  demande_numero: z.string().max(100).nullable().optional(),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Auth admin
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return json({ error: "Non autorisé" }, 401);
  const { data: u, error: uErr } = await service.auth.getUser(token);
  if (uErr || !u?.user) return json({ error: "Non autorisé" }, 401);
  const { data: roles } = await service.from("user_roles").select("role").eq("user_id", u.user.id);
  const r = (roles ?? []).map((x: { role: string }) => x.role);
  if (!r.includes("admin") && !r.includes("super_admin")) return json({ error: "Accès refusé" }, 403);

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
  const b = parsed.data;

  const keyName = b.provider === "mistral" ? "MISTRAL_API_KEY" : "ANTHROPIC_API_KEY";
  const key = Deno.env.get(keyName);
  if (!key) return json({ error: "clé non configurée", code: "cle_manquante" });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  let reponse: string | null = null, erreur: string | null = null;
  let tin: number | null = null, tout: number | null = null;
  let code: string | undefined;

  try {
    let res: Response;
    if (b.provider === "mistral") {
      const messages = [] as { role: string; content: string }[];
      if (b.system) messages.push({ role: "system", content: b.system });
      messages.push({ role: "user", content: b.message });
      res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: b.model, temperature: b.temperature, messages }),
      });
    } else {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: ctrl.signal,
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({
          model: b.model, max_tokens: 4000, temperature: b.temperature,
          ...(b.system ? { system: b.system } : {}),
          messages: [{ role: "user", content: b.message }],
        }),
      });
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      erreur = data?.error?.message ?? data?.message ?? JSON.stringify(data) ?? `HTTP ${res.status}`;
    } else if (b.provider === "mistral") {
      reponse = data?.choices?.[0]?.message?.content ?? "";
      tin = data?.usage?.prompt_tokens ?? null;
      tout = data?.usage?.completion_tokens ?? null;
    } else {
      reponse = (data?.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
      tin = data?.usage?.input_tokens ?? null;
      tout = data?.usage?.output_tokens ?? null;
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") { erreur = "Délai dépassé (120 s) : le fournisseur n'a pas répondu."; code = "timeout"; }
    else erreur = (e as Error).message;
  } finally {
    clearTimeout(timer);
  }
  const duree = Date.now() - t0;

  const { data: row } = await service.from("ia_tests").insert({
    admin_id: u.user.id, provider: b.provider, model: b.model,
    prompt_label: b.prompt_label ?? null, demande_numero: b.demande_numero ?? null,
    temperature: b.temperature, system: b.system, message: b.message,
    reponse, erreur, tokens_entree: tin, tokens_sortie: tout, duree_ms: duree,
  }).select("id").single();

  return json({ id: row?.id ?? null, reponse, error: erreur, code, tokens_entree: tin, tokens_sortie: tout, duree_ms: duree });
});
