// Atelier IA – Étape 2 : passerelle unique vers les modèles (Anthropic / Mistral).
// Auth + rôle → budget mensuel → prompt actif → tarif → quota atomique → appel → log (sans texte du couple).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const TIMEOUT_MS = 120_000;
const USAGES = ["assistant", "filtres", "livret", "charte", "vision"] as const;
type Usage = typeof USAGES[number];
// Modèle choisi par usage ; les noms viennent des secrets, jamais du code.
const NIVEAU: Record<Usage, "LIGHT" | "RICH"> = {
  filtres: "LIGHT", assistant: "LIGHT", vision: "LIGHT", livret: "RICH", charte: "RICH",
};
const AUTORISES_EN_DEGRADE: Usage[] = ["assistant", "filtres"];

const Body = z.object({
  usage: z.enum(USAGES),
  donnees: z.object({
    message: z.string().trim().min(1).max(4000),
    historique: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(20).optional(),
  }),
});

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const erreur = (code: string, message: string, s: number) => json({ error: code, message }, s);

function fournisseur(model: string): "anthropic" | "mistral" | null {
  if (model.startsWith("claude-")) return "anthropic";
  if (model.startsWith("mistral-")) return "mistral";
  return null;
}

function extraireJson(t: string): unknown {
  const s = t.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(s);
}

type Resultat = { texte: string; tin: number; tout: number; stop: string | null };

async function appeler(p: "anthropic" | "mistral", model: string, system: string, maxTokens: number,
  messages: { role: string; content: string }[]): Promise<Resultat> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    if (p === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", signal: ctrl.signal,
        headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "", "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        // Pas de temperature : refusée par les modèles Claude récents.
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(`anthropic ${res.status}: ${d?.error?.message ?? "erreur"}`);
      const texte = (d.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
      if (!texte.trim()) throw new Error("réponse sans bloc texte");
      return { texte, tin: d.usage?.input_tokens ?? 0, tout: d.usage?.output_tokens ?? 0, stop: d.stop_reason ?? null };
    }
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST", signal: ctrl.signal,
      headers: { Authorization: `Bearer ${Deno.env.get("MISTRAL_API_KEY") ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "system", content: system }, ...messages] }),
    });
    const d = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`mistral ${res.status}: ${d?.message ?? "erreur"}`);
    const texte = d.choices?.[0]?.message?.content ?? "";
    if (!texte.trim()) throw new Error("réponse vide");
    return { texte, tin: d.usage?.prompt_tokens ?? 0, tout: d.usage?.completion_tokens ?? 0, stop: d.choices?.[0]?.finish_reason ?? null };
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("délai de 120 s dépassé");
    throw e;
  } finally { clearTimeout(t); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return erreur("methode", "POST uniquement", 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // 1. Authentification et rôle
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: u } = token ? await db.auth.getUser(token) : { data: null };
  const userId = u?.user?.id;
  if (!userId) return erreur("non_authentifie", "Connexion requise", 401);
  const { data: roles } = await db.from("user_roles").select("role").eq("user_id", userId);
  const r = (roles ?? []).map((x: { role: string }) => x.role);
  const estAdmin = r.includes("admin") || r.includes("super_admin");
  if (!estAdmin && (!r.includes("client") || r.includes("prestataire"))) {
    return erreur("acces_refuse", "Réservé aux futurs mariés", 403);
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "donnees_invalides", details: parsed.error.flatten().fieldErrors }, 400);
  const { usage, donnees } = parsed.data;

  const log = (l: Record<string, unknown>) =>
    db.from("ia_logs").insert({ usage, user_id: userId, ...l }).then(({ error }) => error && console.error("log", error));

  // 2. Budget mensuel
  const { data: reg } = await db.from("ia_reglages").select("cle, valeur");
  const R = new Map((reg ?? []).map((x: { cle: string; valeur: unknown }) => [x.cle, x.valeur]));
  const budget = Number(R.get("budget_mensuel_eur") ?? 0);
  const seuils = (R.get("budget_seuils_pct") ?? {}) as { alerte?: number; degrade?: number; bloque?: number };
  const mois = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
  const { data: bm } = await db.from("ia_budget_mois").select("total_eur, suspension_levee_le").eq("mois", mois).maybeSingle();
  const pct = budget > 0 ? (Number(bm?.total_eur ?? 0) / budget) * 100 : 100;
  if (!estAdmin && pct >= (seuils.bloque ?? 120) && !bm?.suspension_levee_le) {
    return erreur("budget_suspendu", "L'assistant IA est momentanément indisponible", 503);
  }
  if (!estAdmin && pct >= (seuils.degrade ?? 100) && !AUTORISES_EN_DEGRADE.includes(usage)) {
    return erreur("mode_degrade", "Cette fonction est momentanément indisponible", 503);
  }

  // 3. Prompt actif
  const { data: prompt } = await db.from("prompts_ia").select("contenu, max_tokens, format_json")
    .eq("usage", usage).eq("actif", true).maybeSingle();
  if (!prompt) return erreur("usage_indisponible", "Cette fonction n'est pas encore disponible", 503);

  // 4. Modèle, fournisseur et tarif
  const model = Deno.env.get(`AI_MODEL_${NIVEAU[usage]}`) ?? "";
  const p = model ? fournisseur(model) : null;
  if (!p) {
    await log({ provider: "inconnu", model: model || "(vide)", statut: "erreur", erreur: `Modèle AI_MODEL_${NIVEAU[usage]} absent ou préfixe non reconnu` });
    return erreur("configuration_incomplete", "Configuration IA incomplète", 500);
  }
  const { data: tarif } = await db.from("ia_tarifs").select("prix_entree_eur_par_million, prix_sortie_eur_par_million").eq("model", model).maybeSingle();
  const tarifOk = tarif?.prix_entree_eur_par_million != null && tarif?.prix_sortie_eur_par_million != null;
  if (!tarifOk && !estAdmin) {
    await log({ provider: p, model, statut: "erreur", erreur: "Tarif manquant dans ia_tarifs" });
    return erreur("configuration_incomplete", "Configuration IA incomplète", 500);
  }

  // 5. Quota (réservation atomique ; les admins n'ont pas de quota)
  if (!estAdmin) {
    const { data: ok, error: qErr } = await db.rpc("reserver_quota_ia", { p_user_id: userId, p_usage: usage });
    if (qErr) return erreur("erreur_interne", "Erreur de quota", 500);
    if (ok !== true) return erreur("quota_atteint", "Vous avez atteint la limite d'utilisation", 429);
  }

  // 6. Appel (1 nouvel essai si le JSON attendu est invalide)
  const messages = [...(donnees.historique ?? []), { role: "user", content: donnees.message }];
  const debut = Date.now();
  let tin = 0, tout = 0, stop: string | null = null, sortie: unknown = null;
  try {
    for (let essai = 0; essai < 2; essai++) {
      const res = await appeler(p, model, prompt.contenu, prompt.max_tokens, messages);
      tin += res.tin; tout += res.tout; stop = res.stop;
      if (!prompt.format_json) { sortie = res.texte; break; }
      try { sortie = extraireJson(res.texte); break; }
      catch { if (essai === 1) throw new Error("JSON invalide après 2 essais"); }
    }
  } catch (e) {
    if (!estAdmin) await db.rpc("annuler_quota_ia", { p_user_id: userId, p_usage: usage });
    const cout = tarifOk ? (tin * Number(tarif!.prix_entree_eur_par_million) + tout * Number(tarif!.prix_sortie_eur_par_million)) / 1e6 : null;
    await log({ provider: p, model, statut: "erreur", erreur: (e as Error).message.slice(0, 500), tokens_entree: tin, tokens_sortie: tout, duree_ms: Date.now() - debut, cout_eur: cout, stop_reason: stop });
    return erreur("erreur_ia", "Le service IA n'a pas pu répondre, réessayez", 502);
  }

  const cout = tarifOk ? (tin * Number(tarif!.prix_entree_eur_par_million) + tout * Number(tarif!.prix_sortie_eur_par_million)) / 1e6 : null;
  await log({ provider: p, model, statut: "succes", tokens_entree: tin, tokens_sortie: tout, duree_ms: Date.now() - debut, cout_eur: cout, stop_reason: stop });

  // 7. Alerte budget (une seule par mois, réservation atomique)
  if (budget > 0) {
    const { data: b2 } = await db.from("ia_budget_mois").select("total_eur").eq("mois", mois).maybeSingle();
    const pct2 = (Number(b2?.total_eur ?? 0) / budget) * 100;
    if (pct2 >= (seuils.alerte ?? 80)) {
      const { data: verrou } = await db.from("ia_budget_mois").update({ alerte_envoyee_le: new Date().toISOString() })
        .eq("mois", mois).is("alerte_envoyee_le", null).select("mois");
      const dest = R.get("email_alerte_budget");
      if (verrou?.length && typeof dest === "string" && dest.includes("@")) {
        const { error: mErr } = await db.functions.invoke("send-app-email", { body: {
          templateName: "alerte_technique_admin", recipientEmail: dest, idempotencyKey: `alerte-budget-ia-${mois}`,
          templateData: {
            symptome: `Budget IA : ${Math.round(pct2)} % consommés`,
            explication: `Le coût IA du mois ${mois} a atteint ${Number(b2?.total_eur).toFixed(2)} € sur un budget de ${budget} €. À ${seuils.degrade ?? 100} % le livret et la charte se coupent ; à ${seuils.bloque ?? 120} % tout l'Atelier IA est suspendu.`,
            lien: "https://lesnoces.net/admin/couts-ia",
          },
        } });
        if (mErr) await db.from("ia_budget_mois").update({ alerte_envoyee_le: null }).eq("mois", mois);
      }
    }
  }

  return json({ resultat: sortie, stop_reason: stop, tronque: stop === "max_tokens" || stop === "length" });
});
