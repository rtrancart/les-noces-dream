// brevo-sync-compteurs — Batch nocturne de rafraîchissement complet des compteurs
// prestataires vers Brevo (pas de détection de delta : full refresh).
//
// Compteurs poussés (prestataires uniquement) :
//   NB_VUES             = count(evenements_prestataire where type = 'vue_profil')
//   NB_DEMANDES_PRESTA  = count(demandes_devis by prestataire_id)
//   NB_FAVORIS          = count(favoris by prestataire_id)
//   TAUX_REPONSE        = prestataires.taux_reponse (calculé par le cron de 02:00)
//   NOTE_MOYENNE        = prestataires.note_moyenne
//
// Mise à jour de masse : POST /contacts/import (jsonBody), lots de 500 contacts,
// soit ~7 appels Brevo pour 3 300 prestataires. Jamais un appel par contact.
//
// Découpage : passes bornées avec auto-relance (pattern process-email-queue) pour
// ne jamais dépasser le timeout ; l'offset est repris d'une passe à l'autre.
//
// Robustesse : un échec Brevo n'affecte aucune donnée métier ; journalisation dans
// brevo_sync_log (kind = 'compteurs_sync') sans donnée sensible.
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

const PAGE_SIZE = 500;
/** Budget de temps d'une passe : au-delà, on relance une nouvelle invocation. */
const BUDGET_MS = 40_000;
const CALL_OPTIONS = { retries: 1, timeoutMs: 20_000 };

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

function describeError(err: unknown): { motif: string; status: number | null } {
  if (err instanceof BrevoError) {
    return {
      motif: `${BREVO_ERROR_LABELS[err.kind]}${err.status ? ` (HTTP ${err.status})` : ""} — ${err.message}`
        .slice(0, 400),
      status: err.status,
    };
  }
  return { motif: err instanceof Error ? err.message : String(err), status: null };
}

const LISTE_PRESTATAIRES = "prestataires";
let listeIdCache: number | null = null;

/** Résout l'id de la liste d'audience prestataires (obligatoire pour /contacts/import). */
async function resoudreListePrestataires(): Promise<number> {
  if (listeIdCache !== null) return listeIdCache;
  const limit = 50;
  for (let offset = 0; offset < 1000; offset += limit) {
    const page = await brevoFetch<{ lists?: { id: number; name: string }[] }>(
      `/contacts/lists?limit=${limit}&offset=${offset}`,
      { method: "GET" },
      CALL_OPTIONS,
    );
    const lists = page?.lists ?? [];
    const hit = lists.find((l) => l.name === LISTE_PRESTATAIRES);
    if (hit) {
      listeIdCache = hit.id;
      return hit.id;
    }
    if (lists.length < limit) break;
  }
  throw new Error(`Liste Brevo « ${LISTE_PRESTATAIRES} » introuvable`);
}

interface Ligne {
  prestataire_id: string;
  email: string;
  nb_vues: number;
  nb_demandes: number;
  nb_favoris: number;
  taux_reponse: number | null;
  note_moyenne: number | null;
  /** true si l'adresse s'est opposée au marketing (signal remonté par Brevo). */
  oppose: boolean;
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

  let body: {
    offset?: number;
    limit?: number;
    dry_run?: boolean;
    max_pages?: number;
    verify_prestataire_id?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* corps vide toléré */
  }

  // Mode diagnostic : relit un contact chez Brevo pour contrôler les compteurs poussés.
  if (typeof (body as { verify_prestataire_id?: string }).verify_prestataire_id === "string") {
    const id = (body as { verify_prestataire_id: string }).verify_prestataire_id;
    const { data: presta } = await admin
      .from("prestataires")
      .select("email_contact")
      .eq("id", id)
      .maybeSingle();
    const email = ((presta?.email_contact as string | null) ?? "").toLowerCase().trim();
    if (!email) return json({ ok: false, message: "Prestataire sans email" }, 404);
    let contact: { attributes?: Record<string, unknown> } | null = null;
    try {
      contact = await brevoFetch<{ attributes?: Record<string, unknown> }>(
        `/contacts/${encodeURIComponent(email)}`,
        { method: "GET" },
        CALL_OPTIONS,
      );
    } catch (err) {
      const { motif, status } = describeError(err);
      return json({ ok: false, motif, status }, 200);
    }
    const a = contact?.attributes ?? {};
    return json({
      ok: true,
      compteurs_brevo: {
        NB_VUES: a.NB_VUES,
        NB_DEMANDES_PRESTA: a.NB_DEMANDES_PRESTA,
        NB_FAVORIS: a.NB_FAVORIS,
        TAUX_REPONSE: a.TAUX_REPONSE,
        NOTE_MOYENNE: a.NOTE_MOYENNE,
      },
    });
  }

  const startedAt = Date.now();
  let offset = Number.isFinite(body.offset) ? Number(body.offset) : 0;
  const pageSize = Number.isFinite(body.limit) ? Number(body.limit) : PAGE_SIZE;
  const dryRun = body.dry_run === true;
  const maxPages = Number.isFinite(body.max_pages) ? Number(body.max_pages) : Infinity;

  let pages = 0;
  let contacts = 0;
  let appelsBrevo = 0;
  let echecs = 0;
  const apercu: unknown[] = [];

  try {
    while (pages < maxPages) {
      const { data, error } = await admin.rpc("brevo_compteurs_prestataires", {
        p_limit: pageSize,
        p_offset: offset,
      });
      if (error) throw new Error(`Lecture compteurs impossible : ${error.message}`);

      const lignes = (data ?? []) as Ligne[];
      if (lignes.length === 0) {
        return json({
          ok: true,
          termine: true,
          offset_final: offset,
          pages,
          contacts,
          appels_brevo: appelsBrevo,
          echecs,
          duree_ms: Date.now() - startedAt,
          ...(dryRun ? { dry_run: true, apercu } : {}),
        });
      }

      const jsonBody = lignes.map((l) => ({
        email: l.email,
        attributes: {
          NB_VUES: l.nb_vues,
          NB_DEMANDES_PRESTA: l.nb_demandes,
          NB_FAVORIS: l.nb_favoris,
          TAUX_REPONSE: l.taux_reponse === null ? 0 : Number(l.taux_reponse),
          NOTE_MOYENNE: l.note_moyenne === null ? 0 : Number(l.note_moyenne),
        },
      }));

      if (dryRun) {
        if (apercu.length < 5) apercu.push(...jsonBody.slice(0, 5 - apercu.length));
      } else {
        try {
          const imported = await brevoFetch<{ processId?: number }>(
            "/contacts/import",
            {
              method: "POST",
              body: JSON.stringify({
                jsonBody,
                listIds: [await resoudreListePrestataires()],
                updateExistingContacts: true,
                emptyContactsAttributes: false,
              }),
            },
            CALL_OPTIONS,
          );
          appelsBrevo++;
          console.log(
            `[brevo-sync-compteurs] lot offset=${offset} taille=${lignes.length} processId=${imported?.processId ?? "?"}`,
          );
          await admin.rpc("brevo_compteurs_journal", {
            p_ids: lignes.map((l) => l.prestataire_id),
            p_statut: "reussi",
            p_motif: null,
            p_status: null,
          });
        } catch (err) {
          appelsBrevo++;
          echecs += lignes.length;
          const { motif, status } = describeError(err);
          console.error(
            `[brevo-sync-compteurs] lot offset=${offset} taille=${lignes.length} échec : ${motif}`,
          );
          await admin.rpc("brevo_compteurs_journal", {
            p_ids: lignes.map((l) => l.prestataire_id),
            p_statut: "a_rejouer",
            p_motif: motif,
            p_status: status,
          });
        }
      }

      contacts += lignes.length;
      offset += lignes.length;
      pages++;

      // Dernière page atteinte : le prochain appel renverrait 0 ligne.
      if (lignes.length < pageSize) break;

      // Passe suivante déportée si le budget de temps est consommé.
      if (Date.now() - startedAt > BUDGET_MS) {
        console.log(`[brevo-sync-compteurs] relance à offset=${offset}`);
        fetch(`${supabaseUrl}/functions/v1/brevo-sync-compteurs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ offset, limit: pageSize, dry_run: dryRun }),
        }).catch((e) => console.error("[brevo-sync-compteurs] relance impossible", e));

        return json({
          ok: true,
          termine: false,
          relance_offset: offset,
          pages,
          contacts,
          appels_brevo: appelsBrevo,
          echecs,
          duree_ms: Date.now() - startedAt,
        });
      }
    }

    console.log(
      `[brevo-sync-compteurs] fin : ${contacts} contact(s), ${appelsBrevo} appel(s) Brevo, ${echecs} en échec`,
    );
    return json({
      ok: echecs === 0,
      termine: true,
      offset_final: offset,
      pages,
      contacts,
      appels_brevo: appelsBrevo,
      echecs,
      duree_ms: Date.now() - startedAt,
      ...(dryRun ? { dry_run: true, apercu } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[brevo-sync-compteurs] erreur inattendue", message);
    return json({ ok: false, message }, 500);
  }
});
