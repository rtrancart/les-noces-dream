// brevo-sync-prestataire — Synchronisation sortante vers Brevo d'un contact « prestataire ».
//
// Appelée de façon découplée :
//  - par les triggers DB sur prestataires et abonnements (via net.http_post, fire-and-forget)
//  - par le cron de rattrapage (mode "retry")
//
// Aucune donnée sensible (email en clair) n'est journalisée ni stockée en base :
// seule une empreinte courte (sha-256 tronquée) sert à détecter un changement d'adresse.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { brevoFetch, BrevoError, BREVO_ERROR_LABELS } from "../_shared/brevo-client.ts";
import { estOppose, ensureListeDesinscrits } from "../_shared/brevo-opposition.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SYNC_KIND = "presta_sync";
const EVENT_KINDS = new Set(["fiche_published", "subscription_started", "compte_active"]);
const MAX_TENTATIVES = 5;
const RETRY_BATCH = 20;
const LISTE_PRESTATAIRES = "prestataires";

const CALL_OPTIONS = { retries: 1, timeoutMs: 10_000 };

function describeError(err: unknown): { motif: string; status: number | null; retryable: boolean } {
  if (err instanceof BrevoError) {
    return {
      motif: `${BREVO_ERROR_LABELS[err.kind]}${err.status ? ` (HTTP ${err.status})` : ""}`,
      status: err.status,
      retryable: err.kind !== "bad_request",
    };
  }
  return { motif: err instanceof Error ? err.message : String(err), status: null, retryable: true };
}

/** Décodage sans vérification : le JWT provient de pg_net (réseau interne). */
function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1]
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function shortHash(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

/* ── Listes Brevo ───────────────────────────────────────────── */

const listCache = new Map<string, number>();
let folderIdCache: number | null = null;

async function ensureFolderId(): Promise<number> {
  if (folderIdCache !== null) return folderIdCache;
  const res = await brevoFetch<{ folders?: { id: number; name: string }[] }>(
    "/contacts/folders?limit=50&offset=0",
    { method: "GET" },
    CALL_OPTIONS,
  );
  const folders = res?.folders ?? [];
  const found = folders.find((f) => f.name?.toLowerCase() === "lesnoces") ?? folders[0];
  if (found) {
    folderIdCache = found.id;
    return found.id;
  }
  const created = await brevoFetch<{ id: number }>(
    "/contacts/folders",
    { method: "POST", body: JSON.stringify({ name: "LesNoces" }) },
    CALL_OPTIONS,
  );
  folderIdCache = created.id;
  return created.id;
}

async function ensureList(nom: string): Promise<number> {
  const cached = listCache.get(nom);
  if (cached) return cached;

  const limit = 50;
  for (let offset = 0; offset < 1000; offset += limit) {
    const page = await brevoFetch<{ lists?: { id: number; name: string }[] }>(
      `/contacts/lists?limit=${limit}&offset=${offset}`,
      { method: "GET" },
      CALL_OPTIONS,
    );
    const lists = page?.lists ?? [];
    const hit = lists.find((l) => l.name === nom);
    if (hit) {
      listCache.set(nom, hit.id);
      return hit.id;
    }
    if (lists.length < limit) break;
  }

  const folderId = await ensureFolderId();
  const created = await brevoFetch<{ id: number }>(
    "/contacts/lists",
    { method: "POST", body: JSON.stringify({ name: nom, folderId }) },
    CALL_OPTIONS,
  );
  listCache.set(nom, created.id);
  return created.id;
}

/* ── Règle métier : dérivation du cycle de vie ───────────────
 * Définition unique dans tout le projet. Ne pas dupliquer ailleurs.
 * Entrées : statut de la fiche + statut de l'abonnement le plus récent.
 */
export function deriveCycleVie(
  statutFiche: string,
  abo: { statut: string | null; fin_periode_le: string | null } | null,
): "essai" | "abonne" | "resilie" | "churned" | "suspendu" {
  if (statutFiche === "archive" || statutFiche === "resilie_expire") return "churned";
  if (statutFiche === "suspendu") return "suspendu";

  const s = abo?.statut ?? null;
  if (!s) return "essai";
  if (s === "trialing") return "essai";
  if (s === "actif" || s === "en_retard" || s === "en_pause") return "abonne";
  if (s === "resilie" || s === "annule") {
    const fin = abo?.fin_periode_le ? new Date(abo.fin_periode_le).getTime() : 0;
    return fin > Date.now() ? "resilie" : "churned";
  }
  return "churned"; // expire
}

type Admin = ReturnType<typeof createClient>;

async function syncPrestataire(admin: Admin, prestataireId: string, kind: string) {
  const { data: presta, error } = await admin
    .from("prestataires")
    .select(
      "id, nom_commercial, email_contact, region, statut, origine, date_premiere_publication, brevo_email_hash, user_id, compte_active_le",
    )
    .eq("id", prestataireId)
    .maybeSingle();

  if (error) throw new Error(`Lecture prestataire impossible : ${error.message}`);
  if (!presta) throw new Error("Prestataire introuvable");

  const email = (presta.email_contact as string | null ?? "").toLowerCase().trim();
  if (!email) throw new Error("Prestataire sans email de contact");

  const { data: abos } = await admin
    .from("abonnements")
    .select("statut, fin_essai_le, fin_periode_le, created_at")
    .eq("prestataire_id", prestataireId)
    .order("created_at", { ascending: false })
    .limit(1);
  const abo = (abos?.[0] ?? null) as
    | { statut: string | null; fin_essai_le: string | null; fin_periode_le: string | null }
    | null;

  // Région : libellé canonique via zones_reference, absente si non résoluble.
  let regionLabel: string | null = null;
  if (presta.region) {
    const { data: label } = await admin.rpc("resoudre_region_label", { p_region: presta.region });
    regionLabel = (label as string | null) ?? null;
  }

  const cycleVie = deriveCycleVie(presta.statut as string, abo);

  // Opposition marketing remontée par Brevo : vérité globale à l'adresse email,
  // elle prime sur l'intérêt légitime B2B (le contact a exprimé un refus explicite).
  const oppose = await estOppose(admin, email);

  const aUnCompte = Boolean(presta.user_id);

  const attributes: Record<string, unknown> = {
    NOM_COMMERCIAL: presta.nom_commercial,
    STATUT_FICHE: presta.statut,
    ORIGINE: presta.origine,
    CYCLE_VIE: cycleVie,
    FIN_ESSAI: toDate(abo?.fin_essai_le),
    DATE_PREMIERE_PUBLI: toDate(presta.date_premiere_publication as string | null),
    REGION: regionLabel ?? undefined,
    A_UN_COMPTE: aUnCompte,
    DATE_ACTIVATION_COMPTE: toDate(presta.compte_active_le as string | null),
    // Intérêt légitime B2B : le prestataire est opt-in par défaut, sauf opposition.
    ...(oppose ? {} : { CONSENTEMENT_MKT: true }),
  };
  for (const k of Object.keys(attributes)) {
    if (attributes[k] === undefined || attributes[k] === null || attributes[k] === "") {
      delete attributes[k];
    }
  }

  // Liste d'audience : technique si opposition, prestataires sinon (échec non bloquant).
  let listIds: number[] | undefined;
  const listeCible = oppose ? "desinscrits_marketing" : LISTE_PRESTATAIRES;
  try {
    listIds = [oppose ? await ensureListeDesinscrits() : await ensureList(LISTE_PRESTATAIRES)];
  } catch (err) {
    const motif = err instanceof BrevoError ? BREVO_ERROR_LABELS[err.kind] : String(err);
    console.error(`[brevo-sync-prestataire] liste ${listeCible} non résolue : ${motif}`);
  }

  // Changement d'email_contact : on renomme le contact existant (identifié par ext_id)
  // au lieu d'en créer un nouveau et de laisser l'ancien orphelin.
  const hash = await shortHash(email);
  const ancienHash = (presta.brevo_email_hash as string | null) ?? null;
  let emailMisAJour = false;
  if (ancienHash && ancienHash !== hash) {
    try {
      await brevoFetch(
        `/contacts/${encodeURIComponent(prestataireId)}?identifierType=ext_id`,
        { method: "PUT", body: JSON.stringify({ attributes: { EMAIL: email } }) },
        CALL_OPTIONS,
      );
      emailMisAJour = true;
    } catch (err) {
      const kindErr = err instanceof BrevoError ? err.kind : null;
      // 404 (contact ext_id inconnu) : l'upsert ci-dessous le créera.
      if (kindErr !== "bad_request") throw err;
      console.error("[brevo-sync-prestataire] renommage email impossible, création à la place");
    }
  }

  // Upsert du contact (ext_id = id de la fiche, stable dans le temps)
  await brevoFetch(
    "/contacts",
    {
      method: "POST",
      body: JSON.stringify({
        email,
        ext_id: prestataireId,
        attributes,
        updateEnabled: true,
        ...(listIds ? { listIds } : {}),
      }),
    },
    CALL_OPTIONS,
  );

  if (ancienHash !== hash) {
    await admin.from("prestataires").update({ brevo_email_hash: hash }).eq("id", prestataireId);
  }

  // Événement marketing conditionnel
  if (EVENT_KINDS.has(kind)) {
    await brevoFetch(
      "/events",
      {
        method: "POST",
        body: JSON.stringify({
          event_name: kind,
          identifiers: { email_id: email },
          event_date: new Date().toISOString(),
          contact_properties: attributes,
          event_properties: {
            prestataire_id: prestataireId,
            statut_fiche: presta.statut,
            origine: presta.origine,
            cycle_vie: cycleVie,
            region: regionLabel,
          },
        }),
      },
      CALL_OPTIONS,
    );
  }

  return {
    kind,
    cycle_vie: cycleVie,
    region_resolue: Boolean(regionLabel),
    attributs: Object.keys(attributes),
    liste_posee: Boolean(listIds),
    liste_cible: listeCible,
    oppose,
    email_renomme: emailMisAJour,
  };
}

async function traiter(admin: Admin, prestataireId: string, kind: string, tentativesActuelles: number) {
  try {
    const res = await syncPrestataire(admin, prestataireId, kind);
    await admin
      .from("brevo_sync_log")
      .update({
        statut: "reussi",
        tentatives: tentativesActuelles + 1,
        dernier_motif: null,
        dernier_status: null,
        updated_at: new Date().toISOString(),
      })
      .eq("prestataire_id", prestataireId)
      .eq("kind", kind);
    console.log(`[brevo-sync-prestataire] ok presta=${prestataireId} kind=${kind}`, res);
    return { prestataire_id: prestataireId, statut: "reussi", ...res };
  } catch (err) {
    const { motif, status, retryable } = describeError(err);
    const tentatives = tentativesActuelles + 1;
    const statut = !retryable || tentatives >= MAX_TENTATIVES ? "abandonne" : "a_rejouer";
    await admin
      .from("brevo_sync_log")
      .update({
        statut,
        tentatives,
        dernier_motif: motif,
        dernier_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq("prestataire_id", prestataireId)
      .eq("kind", kind);
    console.error(
      `[brevo-sync-prestataire] échec presta=${prestataireId} kind=${kind} tentative=${tentatives} statut=${statut} motif=${motif}`,
    );
    return { prestataire_id: prestataireId, kind, statut, motif };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const claims = parseJwtClaims(token);
  if (token !== serviceRoleKey && claims?.role !== "service_role") {
    return json({ ok: false, message: "Non autorisé" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  let body: { prestataire_id?: string; kind?: string; mode?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* corps vide toléré */
  }

  try {
    if (body.mode === "retry" || !body.prestataire_id) {
      const { data: rows, error } = await admin
        .from("brevo_sync_log")
        .select("prestataire_id, kind, tentatives")
        .not("prestataire_id", "is", null)
        .eq("statut", "a_rejouer")
        .lt("tentatives", MAX_TENTATIVES)
        .order("created_at", { ascending: true })
        .limit(RETRY_BATCH);
      if (error) throw error;

      const resultats = [];
      for (const row of rows ?? []) {
        resultats.push(
          await traiter(
            admin,
            row.prestataire_id as string,
            row.kind as string,
            (row.tentatives as number) ?? 0,
          ),
        );
      }
      console.log(`[brevo-sync-prestataire] rattrapage : ${resultats.length} ligne(s)`);
      return json({ ok: true, mode: "retry", traitees: resultats.length, resultats });
    }

    const kind = body.kind && (EVENT_KINDS.has(body.kind) || body.kind === SYNC_KIND)
      ? body.kind
      : SYNC_KIND;

    const { data: existing } = await admin
      .from("brevo_sync_log")
      .select("tentatives, statut")
      .eq("prestataire_id", body.prestataire_id)
      .eq("kind", kind)
      .maybeSingle();

    if (!existing) {
      await admin.from("brevo_sync_log").insert({ prestataire_id: body.prestataire_id, kind });
    } else if (existing.statut === "reussi" && EVENT_KINDS.has(kind)) {
      // Un événement marketing ne se rejoue jamais ; la synchro d'état, si.
      return json({ ok: true, deja_synchronise: true });
    }

    const res = await traiter(
      admin,
      body.prestataire_id,
      kind,
      EVENT_KINDS.has(kind) ? ((existing?.tentatives as number) ?? 0) : 0,
    );
    return json({ ok: res.statut === "reussi", ...res });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[brevo-sync-prestataire] erreur inattendue", message);
    return json({ ok: false, message }, 500);
  }
});
