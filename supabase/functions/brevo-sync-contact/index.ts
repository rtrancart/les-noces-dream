// brevo-sync-contact — Synchronisation sortante vers Brevo d'un contact « marié »
// au moment d'une demande de devis.
//
// Appelée de façon découplée :
//  - par le trigger AFTER INSERT sur demandes_devis (via net.http_post, fire-and-forget)
//  - par le cron de rattrapage (mode "retry") qui rejoue les lignes en échec
//
// Aucune donnée sensible (email, message, téléphone) n'est journalisée.
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

const KIND = "contact_submitted";
const MAX_TENTATIVES = 5;
const RETRY_BATCH = 20;

/** Retry court : le rattrapage durable est assuré par le cron + le journal. */
const CALL_OPTIONS = { retries: 1, timeoutMs: 10_000 };

function describeError(err: unknown): { motif: string; status: number | null; retryable: boolean } {
  if (err instanceof BrevoError) {
    return {
      motif: `${BREVO_ERROR_LABELS[err.kind]}${err.status ? ` (HTTP ${err.status})` : ""}`,
      status: err.status,
      // Une clé absente/invalide ou une requête refusée ne se répare pas toute seule,
      // mais on garde la ligne rejouable : l'admin corrige puis le cron repasse.
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

function splitNom(nomComplet: string | null): { prenom: string; nom: string } {

  const parts = (nomComplet ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { prenom: "", nom: "" };
  if (parts.length === 1) return { prenom: parts[0], nom: "" };
  return { prenom: parts[0], nom: parts.slice(1).join(" ") };
}

function toDate(value: string | null): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

/** contact_{categorie} : minuscules, sans accents, séparateurs en underscore. */
function slugTag(libelle: string): string {
  const base = libelle
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `contact_${base}`;
}

/** Cache nom -> id, valable pour la durée de vie de l'instance. */
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

/** Retrouve la liste par nom, la crée si absente. Brevo dédoublonne nativement l'appartenance. */
async function ensureList(nom: string): Promise<number> {
  const cached = listCache.get(nom);
  if (cached) return cached;

  const limit = 50;
  for (let offset = 0; offset < 1000; offset += limit) {
    const page = await brevoFetch<{ lists?: { id: number; name: string }[]; count?: number }>(
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

type Admin = ReturnType<typeof createClient>;

async function syncDemande(admin: Admin, demandeId: string) {
  const { data: demande, error } = await admin
    .from("demandes_devis")
    .select(`
      id, nom_contact, email_contact, objet, date_evenement, created_at,
      profile_id, contact_id,
      prestataire:prestataires!demandes_devis_prestataire_id_fkey (
        nom_commercial, region,
        categorie:categories!prestataires_categorie_mere_id_fkey ( nom )
      ),
      contact:contacts_anonymes!demandes_devis_contact_id_fkey ( prenom, profile_id )
    `)
    .eq("id", demandeId)
    .maybeSingle();

  if (error) throw new Error(`Lecture demande impossible : ${error.message}`);
  if (!demande) throw new Error("Demande introuvable");

  const email = (demande.email_contact ?? "").toLowerCase().trim();
  if (!email) throw new Error("Demande sans email");

  const presta = (demande.prestataire ?? null) as
    | { nom_commercial: string | null; region: string | null; categorie: { nom: string } | null }
    | null;
  const contact = (demande.contact ?? null) as { prenom: string | null; profile_id: string | null } | null;

  // Région : libellé canonique via zones_reference, NULL si non résoluble.
  let prestaRegion: string | null = null;
  if (presta?.region) {
    const { data: label } = await admin.rpc("resoudre_region_label", { p_region: presta.region });
    prestaRegion = (label as string | null) ?? null;
  }

  const split = splitNom(demande.nom_contact);
  const prenom = (contact?.prenom ?? "").trim() || split.prenom;

  const attributes: Record<string, unknown> = {
    PRENOM: prenom,
    NOM: split.nom,
    TYPE_EVENEMENT: demande.objet,
    DATE_EVENT: toDate(demande.date_evenement),
    DATE_CONTACT: toDate(demande.created_at),
    CONSENTEMENT_MKT: false,
    A_UN_COMPTE: Boolean(contact?.profile_id ?? demande.profile_id),
  };
  for (const k of Object.keys(attributes)) {
    if (attributes[k] === undefined || attributes[k] === "") delete attributes[k];
  }

  // Marqueur de catégorie contactée : une liste Brevo par catégorie mère.
  // Brevo dédoublonne nativement l'appartenance ; un échec ici ne bloque pas la synchro.
  let tagListe: string | null = null;
  let listIds: number[] | undefined;
  const categorieNom = presta?.categorie?.nom ?? null;
  if (categorieNom) {
    tagListe = slugTag(categorieNom);
    try {
      listIds = [await ensureList(tagListe)];
    } catch (err) {
      const motif = err instanceof BrevoError ? BREVO_ERROR_LABELS[err.kind] : String(err);
      console.error(`[brevo-sync-contact] liste ${tagListe} non résolue : ${motif}`);
      listIds = undefined;
    }
  }

  // 1) Upsert du contact (identifié par l'email)
  await brevoFetch(
    "/contacts",
    {
      method: "POST",
      body: JSON.stringify({
        email,
        attributes,
        updateEnabled: true,
        ...(listIds ? { listIds } : {}),
      }),
    },
    CALL_OPTIONS,
  );


  // 2) Événement de suivi
  await brevoFetch(
    "/events",
    {
      method: "POST",
      body: JSON.stringify({
        event_name: KIND,
        identifiers: { email_id: email },
        event_date: new Date(demande.created_at as string).toISOString(),
        contact_properties: attributes,
        event_properties: {
          demande_id: demande.id,
          type_evenement: demande.objet,
          presta_nom: presta?.nom_commercial ?? null,
          presta_cat: categorieNom,
          presta_region: prestaRegion,
          tag_liste: tagListe,
        },
      }),
    },
    CALL_OPTIONS,
  );

  return {
    region_resolue: Boolean(prestaRegion),
    attributs: Object.keys(attributes),
    tag_liste: tagListe,
    liste_posee: Boolean(listIds),
  };
}

async function traiter(admin: Admin, demandeId: string, tentativesActuelles: number) {
  try {
    const res = await syncDemande(admin, demandeId);
    await admin
      .from("brevo_sync_log")
      .update({
        statut: "reussi",
        tentatives: tentativesActuelles + 1,
        dernier_motif: null,
        dernier_status: null,
        updated_at: new Date().toISOString(),
      })
      .eq("demande_id", demandeId)
      .eq("kind", KIND);
    console.log(`[brevo-sync-contact] ok demande=${demandeId}`, res);
    return { demande_id: demandeId, statut: "reussi", ...res };
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
      .eq("demande_id", demandeId)
      .eq("kind", KIND);
    console.error(`[brevo-sync-contact] échec demande=${demandeId} tentative=${tentatives} statut=${statut} motif=${motif}`);
    return { demande_id: demandeId, statut, motif };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  // Appel machine uniquement (trigger pg_net ou cron), jamais depuis le navigateur.
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const claims = parseJwtClaims(token);
  if (token !== serviceRoleKey && claims?.role !== "service_role") {
    return json({ ok: false, message: "Non autorisé" }, 401);
  }


  const admin = createClient(supabaseUrl, serviceRoleKey);

  let body: { demande_id?: string; mode?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* corps vide toléré */
  }

  try {
    if (body.mode === "retry" || !body.demande_id) {
      const { data: rows, error } = await admin
        .from("brevo_sync_log")
        .select("demande_id, tentatives")
        .eq("kind", KIND)
        .eq("statut", "a_rejouer")
        .lt("tentatives", MAX_TENTATIVES)
        .order("created_at", { ascending: true })
        .limit(RETRY_BATCH);
      if (error) throw error;

      const resultats = [];
      for (const row of rows ?? []) {
        resultats.push(await traiter(admin, row.demande_id as string, (row.tentatives as number) ?? 0));
      }
      console.log(`[brevo-sync-contact] rattrapage : ${resultats.length} ligne(s) traitée(s)`);
      return json({ ok: true, mode: "retry", traitees: resultats.length, resultats });
    }

    const { data: existing } = await admin
      .from("brevo_sync_log")
      .select("tentatives, statut")
      .eq("demande_id", body.demande_id)
      .eq("kind", KIND)
      .maybeSingle();

    if (!existing) {
      await admin.from("brevo_sync_log").insert({ demande_id: body.demande_id, kind: KIND });
    } else if (existing.statut === "reussi") {
      return json({ ok: true, deja_synchronise: true });
    }

    const res = await traiter(admin, body.demande_id, (existing?.tentatives as number) ?? 0);
    return json({ ok: res.statut === "reussi", ...res });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[brevo-sync-contact] erreur inattendue", message);
    return json({ ok: false, message }, 500);
  }
});
