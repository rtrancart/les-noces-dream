// ─── Usage 'assistant' : tool calling Anthropic + recherche sémantique ───
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const CHAMPS_INTERNES = ["sim_brute", "pertinence_norm", "score_classement", "score", "meme_region"];
const MAX_APPELS_OUTIL = 2;
const TIMEOUT_MS = 120_000;

type Tarif = { e: number; s: number } | null;
type Ctx = {
  db: SupabaseClient; userId: string; model: string; embedModel: string;
  tarif: (m: string) => Promise<Tarif>;
  log: (l: Record<string, unknown>) => Promise<unknown>;
};

async function fetchTimeout(url: string, init: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); }
  catch (e) { if ((e as Error).name === "AbortError") throw new Error("délai de 120 s dépassé"); throw e; }
  finally { clearTimeout(t); }
}

const cout = (t: Tarif, tin: number, tout: number) => t ? (tin * t.e + tout * t.s) / 1e6 : null;

export async function embedding(ctx: Ctx, texte: string): Promise<number[]> {
  const t0 = Date.now();
  const res = await fetchTimeout("https://api.mistral.ai/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("MISTRAL_API_KEY") ?? ""}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: ctx.embedModel, input: [texte] }),
  });
  const d = await res.json().catch(() => null);
  const tin = d?.usage?.prompt_tokens ?? 0;
  const tar = await ctx.tarif(ctx.embedModel);
  if (!res.ok || !d?.data?.[0]?.embedding) {
    await ctx.log({ usage: "embedding", provider: "mistral", model: ctx.embedModel, statut: "erreur", erreur: `mistral ${res.status}: ${d?.message ?? "erreur"}`.slice(0, 500), duree_ms: Date.now() - t0 });
    throw new Error("embedding indisponible");
  }
  await ctx.log({ usage: "embedding", provider: "mistral", model: ctx.embedModel, statut: "succes", tokens_entree: tin, tokens_sortie: 0, duree_ms: Date.now() - t0, cout_eur: cout(tar, tin, 0) });
  return d.data[0].embedding;
}

export type ParamsRecherche = {
  categorie?: string | null; sous_categorie?: string | null; departements?: string[];
  budget_max_eur?: number | null; intention?: string; [k: string]: unknown;
};

/** Appelle la fonction SQL ; renvoie le JSON brut (avec champs internes) et la durée SQL. */
export async function rechercher(ctx: Ctx, p: ParamsRecherche) {
  const intention = String(p.intention ?? "").trim() || [p.categorie, p.sous_categorie].filter(Boolean).join(" ") || "prestataire de mariage";
  const vec = await embedding(ctx, intention);
  const t0 = Date.now();
  const { data, error } = await ctx.db.rpc("rechercher_prestataires", {
    p_categorie: p.categorie ?? null,
    p_sous_categorie: p.sous_categorie ?? null,
    p_departements: Array.isArray(p.departements) ? p.departements.map(String) : null,
    p_embedding_intention: JSON.stringify(vec),
    p_budget_max_eur: typeof p.budget_max_eur === "number" ? p.budget_max_eur : null,
    p_limite: 10,
  });
  if (error) throw new Error(`recherche: ${error.message}`);
  return { brut: data as { resultats?: Record<string, unknown>[]; erreur?: string }, duree_sql_ms: Date.now() - t0 };
}

/** Version envoyée à l'IA : sans les champs de classement internes. */
export function pourIA(brut: { resultats?: Record<string, unknown>[]; erreur?: string }) {
  if (!brut.resultats) return brut;
  return { resultats: brut.resultats.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !CHAMPS_INTERNES.includes(k)))) };
}

function outil(reglesFiltres: string) {
  return {
    name: "rechercher_prestataires",
    description: `Recherche des prestataires de mariage actifs sur LesNoces.net, classés par pertinence. Renvoie au plus 10 fiches ; une fiche marquée hors_zone ne couvre pas la zone demandée.\n\n${reglesFiltres}`,
    input_schema: {
      type: "object",
      properties: {
        categorie: { type: ["string", "null"], description: "Catégorie principale exacte de la liste, ou null" },
        sous_categorie: { type: ["string", "null"], description: "Sous-catégorie seulement si le couple la nomme explicitement" },
        departements: { type: "array", items: { type: "string" }, description: "Numéros de département (ex. \"35\", \"2A\")" },
        date_mariage: { type: ["string", "null"], description: "AAAA-MM-JJ ou AAAA-MM" },
        nb_invites: { type: ["number", "null"] },
        budget_max_eur: { type: ["number", "null"] },
        intention: { type: "string", description: "Phrase courte reprenant le style et les attentes du couple, avec ses mots" },
        exclusions: { type: "array", items: { type: "string" } },
        criteres_pratiques: { type: "array", items: { type: "string" } },
      },
      required: ["intention"],
    },
  };
}

type Bloc = { type: string; text?: string; id?: string; name?: string; input?: unknown };
async function claude(model: string, body: Record<string, unknown>, effort: string | null) {
  const envoyer = (b: Record<string, unknown>) => fetchTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "", "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    // Pas de temperature : refusée par les modèles Claude récents.
    body: JSON.stringify({ model, ...b }),
  });
  let res = await envoyer(effort ? { ...body, output_config: { effort } } : body);
  let d = await res.json().catch(() => null);
  let effortIgnore = false;
  if (!res.ok && effort && res.status === 400 && /effort|output_config/i.test(d?.error?.message ?? "")) {
    effortIgnore = true;
    res = await envoyer(body); d = await res.json().catch(() => null);
  }
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${d?.error?.message ?? "erreur"}`);
  return { content: (d.content ?? []) as Bloc[], tin: d.usage?.input_tokens ?? 0, tout: d.usage?.output_tokens ?? 0, stop: d.stop_reason as string | null, effortIgnore };
}

function extraireJson(t: string): unknown {
  const s = t.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try { return JSON.parse(s); } catch {
    const m = s.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error("json");
  }
}

export type Reco = { prestataire_id: string; raison: string };

export async function executerAssistant(ctx: Ctx, opts: {
  system: string; maxTokens: number; effort: string | null; reglesFiltres: string;
  messages: { role: "user" | "assistant"; content: string }[];
}) {
  const tools = [outil(opts.reglesFiltres)];
  const conv: { role: string; content: unknown }[] = [...opts.messages];
  const fiches = new Map<string, Record<string, unknown>>();
  let appelsOutil = 0, tin = 0, tout = 0, stop: string | null = null, effortIgnore = false;
  let texte = "";
  for (let tour = 0; tour < MAX_APPELS_OUTIL + 2; tour++) {
    const limite = appelsOutil >= MAX_APPELS_OUTIL;
    const r = await claude(ctx.model, {
      max_tokens: opts.maxTokens, system: opts.system, messages: conv, tools,
      ...(limite ? { tool_choice: { type: "none" } } : {}),
    }, opts.effort);
    tin += r.tin; tout += r.tout; stop = r.stop; effortIgnore ||= r.effortIgnore;
    const usages = r.content.filter((b) => b.type === "tool_use");
    if (r.stop === "tool_use" && usages.length && !limite) {
      conv.push({ role: "assistant", content: r.content });
      const resultats = [];
      for (const u of usages) {
        if (appelsOutil >= MAX_APPELS_OUTIL) {
          resultats.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify({ erreur: "limite_appels", message: "Nombre maximal de recherches atteint pour ce message." }) });
          continue;
        }
        appelsOutil++;
        try {
          const { brut } = await rechercher(ctx, (u.input ?? {}) as ParamsRecherche);
          for (const f of brut.resultats ?? []) fiches.set(String(f.id), f);
          resultats.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(pourIA(brut)) });
        } catch (e) {
          resultats.push({ type: "tool_result", tool_use_id: u.id, is_error: true, content: `Recherche indisponible : ${(e as Error).message}` });
        }
      }
      conv.push({ role: "user", content: resultats });
      continue;
    }
    texte = r.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
    break;
  }
  let sortie: { message?: unknown; recommandations?: unknown };
  try { sortie = extraireJson(texte) as typeof sortie; }
  catch {
    // Un nouvel essai, sans outil, pour obtenir le JSON demandé.
    conv.push({ role: "assistant", content: texte || "(vide)" });
    conv.push({ role: "user", content: "Reformule ta réponse précédente UNIQUEMENT sous forme de l'objet JSON demandé, sans texte autour." });
    const r = await claude(ctx.model, { max_tokens: opts.maxTokens, system: opts.system, messages: conv, tools, tool_choice: { type: "none" } }, opts.effort);
    tin += r.tin; tout += r.tout; stop = r.stop;
    sortie = extraireJson(r.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("")) as typeof sortie;
  }
  const message = typeof sortie.message === "string" ? sortie.message : "";
  if (!message.trim()) throw new Error("réponse sans message");
  const brutes = Array.isArray(sortie.recommandations) ? sortie.recommandations as Reco[] : [];
  const inventes: string[] = [];
  const recos: (Reco & { fiche: Record<string, unknown> })[] = [];
  for (const r of brutes) {
    const id = String(r?.prestataire_id ?? "");
    const f = fiches.get(id);
    if (!f) { inventes.push(id); continue; }
    if (recos.some((x) => x.prestataire_id === id)) continue;
    recos.push({ prestataire_id: id, raison: String(r.raison ?? "").slice(0, 400), fiche: f });
    if (recos.length >= 4) break;
  }
  return { message, recos, inventes, appelsOutil, tin, tout, stop, effortIgnore };
}
