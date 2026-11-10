// Atelier IA – Étape 1b : génère tags_ia (Claude Haiku) et embedding (Mistral Embed) depuis la file embeddings_a_recalculer.
// Appelée par un admin (JWT + rôle) ou par le service role (cron). Mode test : { test_ids: [...] }.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

// Aucun nom de modèle en dur : lus depuis les secrets AI_MODEL_LIGHT et EMBEDDING_MODEL.
const CLAUDE_MODEL = Deno.env.get("AI_MODEL_LIGHT") ?? "";
const EMBED_MODEL = Deno.env.get("EMBEDDING_MODEL") ?? "";
const LOT = 50;
// Rythme lent (traitement de nuit) : pause entre deux fiches pour rester sous la limite de débit Mistral.
const PAUSE_MS = 1200;
const MAX_TEXTE = 6000;
const AMBIANCES = [
  "Champêtre", "Bohème", "Romantique", "Chic / classique", "Minimaliste", "Moderne / contemporain",
  "Vintage / rétro", "Baroque", "Art déco", "Industriel", "Méditerranéen", "Tropical / exotique",
  "Nature / forêt", "Bord de mer", "Glamour", "Sobre / corporate",
];
const ETIQUETTES_FIXES = ["Éco-responsable"];
const MAX_TAGS = 12;

const Body = z.object({ test_ids: z.array(z.string().uuid()).max(50).optional() });
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256(t: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const vide = (v: unknown) =>
  v == null || (typeof v === "string" && v.trim() === "") ||
  (typeof v === "object" && Object.keys(v as object).length === 0);

function champsEnTexte(cs: Record<string, unknown> | null, labels: Map<string, string>) {
  if (!cs) return "";
  return Object.entries(cs)
    .filter(([, v]) => !vide(v) && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${labels.get(k) ?? k} : ${Array.isArray(v) ? v.join(", ") : String(v)}`)
    .join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, serviceKey);

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return json({ error: "Non autorisé" }, 401);
  if (token !== serviceKey) {
    const { data: u } = await db.auth.getUser(token);
    if (!u?.user) return json({ error: "Non autorisé" }, 401);
    const { data: roles } = await db.from("user_roles").select("role").eq("user_id", u.user.id);
    const r = (roles ?? []).map((x: { role: string }) => x.role);
    if (!r.includes("admin") && !r.includes("super_admin")) return json({ error: "Accès refusé" }, 403);
  }
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
  const testIds = parsed.data.test_ids;

  const anthKey = Deno.env.get("ANTHROPIC_API_KEY");
  const mistralKey = Deno.env.get("MISTRAL_API_KEY");
  if (!anthKey || !mistralKey) return json({ error: "Clé API manquante" }, 500);
  if (!CLAUDE_MODEL || !EMBED_MODEL) return json({ error: "Secret AI_MODEL_LIGHT ou EMBEDDING_MODEL manquant" }, 500);

  let ids: string[];
  if (testIds) ids = testIds;
  else {
    const { data } = await db.from("embeddings_a_recalculer").select("prestataire_id").order("demande_le").limit(LOT);
    ids = (data ?? []).map((x: { prestataire_id: string }) => x.prestataire_id);
  }
  if (!ids.length) return json({ resultats: [] });

  const { data: fiches, error: fErr } = await db.from("prestataires")
    .select("id, nom_commercial, statut, description, description_courte, champs_specifiques, tags, ville, categorie_mere_id, categorie_fille_id, sources_hash, tags_ia, tags_ia_hash, embedding_hash")
    .in("id", ids);
  if (fErr) return json({ error: fErr.message }, 500);

  const { data: cats } = await db.from("categories").select("id, nom");
  const nomCat = new Map((cats ?? []).map((c: { id: string; nom: string }) => [c.id, c.nom]));
  const { data: champs } = await db.from("champs_categories").select("categorie_id, cle, label, options_liste, usage_ia, options_exclues_ia");

  const resultats: unknown[] = [];
  const log = (row: Record<string, unknown>) => db.from("ia_logs").insert(row);

  for (const f of fiches ?? []) {
    const res: Record<string, unknown> = { id: f.id, nom: f.nom_commercial };
    if (f.statut !== "actif") {
      await db.from("embeddings_a_recalculer").delete().eq("prestataire_id", f.id);
      resultats.push({ ...res, ignore: "statut non actif" });
      continue;
    }
    const catIds = [f.categorie_mere_id, f.categorie_fille_id].filter(Boolean);
    const champsFiche = (champs ?? []).filter((c: { categorie_id: string | null }) =>
      c.categorie_id === null || catIds.includes(c.categorie_id));
    const labels = new Map(champsFiche.map((c: { cle: string; label: string }) => [c.cle, c.label]));
    const vocab = [...new Set([...AMBIANCES, ...ETIQUETTES_FIXES, ...champsFiche
      .filter((c: { usage_ia: boolean }) => c.usage_ia)
      .flatMap((c: { options_liste: string[] | null; options_exclues_ia: string[] | null }) =>
        (c.options_liste ?? []).filter((o) => !(c.options_exclues_ia ?? []).includes(o)))])];
    const categorie = [nomCat.get(f.categorie_mere_id), f.categorie_fille_id ? nomCat.get(f.categorie_fille_id) : null].filter(Boolean).join(" / ");
    const cs = champsEnTexte(f.champs_specifiques as Record<string, unknown> | null, labels);
    const sansContenu = vide(f.description) && vide(f.description_courte) && cs === "";
    const sources = [f.nom_commercial, categorie, f.ville, f.description_courte ?? "", f.description ?? "", cs, (f.tags ?? []).join(", ")].join("\n");
    const sourcesHash = await sha256(sources);
    const maj: Record<string, unknown> = { sources_hash: sourcesHash };
    let tagsIa: string[] = f.tags_ia ?? [];

    try {
      if (testIds || sourcesHash !== f.tags_ia_hash) {
        if (sansContenu) {
          tagsIa = [];
        } else {
          const t0 = Date.now();
          const r = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "x-api-key": anthKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
            body: JSON.stringify({
              model: CLAUDE_MODEL, max_tokens: 2000,
              system: "Tu qualifies des prestataires de mariage. Choisis UNIQUEMENT des étiquettes de la liste fournie, recopiées à l'identique, et seulement si le texte les justifie explicitement. N'invente rien. Si le texte est pauvre, renvoie peu d'étiquettes, voire aucune. Maximum 12. Réponds uniquement par un tableau JSON de chaînes.",
              messages: [{ role: "user", content: `Liste autorisée :\n${JSON.stringify(vocab)}\n\nFiche :\n${sources.slice(0, MAX_TEXTE)}` }],
            }),
          });
          const d = await r.json();
          const duree = Date.now() - t0;
          if (!r.ok) throw Object.assign(new Error(d?.error?.message ?? `Anthropic ${r.status}`), { usage: "tags_ia" });
          const texte = (d.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
          const m = texte.match(/\[[\s\S]*\]/);
          const brut: unknown[] = m ? JSON.parse(m[0]) : [];
          const permis = new Set(vocab);
          tagsIa = [...new Set(brut.filter((x): x is string => typeof x === "string" && permis.has(x)))].slice(0, MAX_TAGS);
          res.tags_rejetes = brut.filter((x) => !permis.has(x as string));
          res.taille_vocabulaire = vocab.length;
          res.tokens_claude = [d.usage?.input_tokens, d.usage?.output_tokens];
          res.duree_claude_ms = duree;
          await log({ usage: "tags_ia", provider: "anthropic", model: CLAUDE_MODEL, prestataire_id: f.id, tokens_entree: d.usage?.input_tokens, tokens_sortie: d.usage?.output_tokens, duree_ms: duree });
        }
        maj.tags_ia = tagsIa;
        maj.tags_ia_hash = sourcesHash;
      }
      const embHash = await sha256(sourcesHash + "|" + tagsIa.join(","));
      if (testIds || embHash !== f.embedding_hash) {
        const texteVec = (sansContenu
          ? [f.nom_commercial, categorie, f.ville].join("\n")
          : [sources, tagsIa.length ? `Style : ${tagsIa.join(", ")}` : ""].join("\n")).slice(0, MAX_TEXTE);
        const t0 = Date.now();
        const r = await fetch("https://api.mistral.ai/v1/embeddings", {
          method: "POST",
          headers: { Authorization: `Bearer ${mistralKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: EMBED_MODEL, input: [texteVec] }),
        });
        const d = await r.json();
        const duree = Date.now() - t0;
        if (!r.ok) throw Object.assign(new Error(d?.message ?? `Mistral ${r.status}`), { usage: "embedding" });
        maj.embedding = JSON.stringify(d.data[0].embedding);
        maj.embedding_hash = embHash;
        maj.embedding_le = new Date().toISOString();
        res.longueur_texte_vectorise = texteVec.length;
        res.tokens_embed = d.usage?.prompt_tokens;
        res.duree_embed_ms = duree;
        await log({ usage: "embedding", provider: "mistral", model: EMBED_MODEL, prestataire_id: f.id, tokens_entree: d.usage?.prompt_tokens, duree_ms: duree });
      }
      const { error: uErr } = await db.from("prestataires").update(maj).eq("id", f.id).select("id").single();
      if (uErr) throw new Error(uErr.message);
      await db.from("embeddings_a_recalculer").delete().eq("prestataire_id", f.id);
      resultats.push({ ...res, categorie, extrait: (f.description ?? f.description_courte ?? "").slice(0, 200), tags_ia: tagsIa, sans_contenu: sansContenu });
    } catch (e) {
      const usage = (e as { usage?: string }).usage ?? "embedding";
      await log({ usage, provider: usage === "tags_ia" ? "anthropic" : "mistral", model: usage === "tags_ia" ? CLAUDE_MODEL : EMBED_MODEL, prestataire_id: f.id, statut: "erreur", erreur: String((e as Error).message).slice(0, 1000) });
      resultats.push({ ...res, erreur: (e as Error).message });
    }
  }
  return json({ resultats });
});
