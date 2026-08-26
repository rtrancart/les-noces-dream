// prerender-reconcile — Réconciliation de la file de pré-rendu.
//
// Principe : chaque nuit, on compare l'ensemble des pages indexables (source de
// vérité partagée avec le sitemap, cf. _shared/pages-indexables.ts) avec l'état
// de `prerender_queue`, puis on corrige la différence :
//   - page indexable absente de la file       → insérée en `a_traiter`
//   - page indexable dont l'empreinte a changé → remise en `a_traiter`
//   - page indexable inchangée                 → rien (court-circuit au rendu)
//   - entrée de file non indexable (orpheline) → snapshot effacé puis ligne supprimée
//
// Découpage : tranches bornées + budget de temps (modèle brevo-sync-compteurs),
// avec auto-relance facultative. Jamais d'opération monolithique.
//
// Garde-fou : si la purge porte sur une part anormale de la file, elle est
// refusée et journalisée — une erreur de filtre ne peut pas vider le bucket.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BUCKET = "prerender-snapshots";
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;
const PURGE_CHUNK = 100;
const BUDGET_MS = 40_000;
/** Au-delà de ce ratio d'entrées à purger, on s'arrête sans rien effacer. */
const SEUIL_PURGE_PCT = 30;
/** En deçà de ce nombre, la purge passe toujours (petites files de préproduction). */
const PURGE_PLANCHER = 20;

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const claims = parseJwtClaims(token);
  const isServiceRole = token === serviceRoleKey || claims?.role === "service_role";

  if (!isServiceRole) {
    // Voie alternative : admin authentifié (panneau back-office).
    if (!token) return json({ ok: false, message: "Non autorisé" }, 401);
    const asUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData } = await asUser.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return json({ ok: false, message: "Non autorisé" }, 401);

    const svc = createClient(supabaseUrl, serviceRoleKey);
    const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([
      svc.rpc("has_role", { _user_id: uid, _role: "admin" }),
      svc.rpc("has_role", { _user_id: uid, _role: "super_admin" }),
    ]);
    if (isAdmin !== true && isSuper !== true) {
      return json({ ok: false, message: "Accès réservé aux administrateurs" }, 403);
    }
  }

  let body: {
    limit?: number;
    offset?: number;
    purge?: boolean;
    dry_run?: boolean;
    auto_relance?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* corps vide toléré */
  }

  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(body.limit) || DEFAULT_LIMIT));
  let offset = Math.max(0, Number(body.offset) || 0);
  const avecPurge = body.purge !== false;
  const dryRun = body.dry_run === true;
  const autoRelance = body.auto_relance === true;

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const startedAt = Date.now();

  let tranches = 0;
  let recensees = 0;
  let ajoutees = 0;
  let remises = 0;
  let inchangees = 0;
  let purgees = 0;
  let purgeRefusee: string | null = null;

  try {
    // ---- Phase 1 : synchronisation par tranches -----------------------------
    let termineRecensement = false;
    while (Date.now() - startedAt < BUDGET_MS) {
      const { data, error } = await admin.rpc("prerender_reconcilier", {
        p_limit: limit,
        p_offset: offset,
      });
      if (error) throw new Error(`Réconciliation impossible : ${error.message}`);

      const row = (Array.isArray(data) ? data[0] : data) as
        | { traitees: number; ajoutees: number; remises: number; inchangees: number }
        | null;
      const traitees = Number(row?.traitees ?? 0);

      tranches++;
      recensees += traitees;
      ajoutees += Number(row?.ajoutees ?? 0);
      remises += Number(row?.remises ?? 0);
      inchangees += Number(row?.inchangees ?? 0);
      offset += traitees;

      if (traitees < limit) {
        termineRecensement = true;
        break;
      }
    }

    if (!termineRecensement) {
      // Budget épuisé : on rend la main, la reprise se fait à l'offset courant.
      if (autoRelance) {
        void fetch(`${supabaseUrl}/functions/v1/prerender-reconcile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ limit, offset, purge: avecPurge, auto_relance: true, dry_run: dryRun }),
        }).catch((e) => console.error("[prerender-reconcile] relance échouée", e));
      }
      return json({
        ok: true,
        termine: false,
        relance_offset: offset,
        tranches,
        recensees,
        ajoutees,
        remises,
        inchangees,
        purgees: 0,
        duree_ms: Date.now() - startedAt,
      });
    }

    // ---- Phase 2 : purge des entrées devenues non indexables ----------------
    if (avecPurge) {
      const { data: statsData, error: statsErr } = await admin.rpc("prerender_stats");
      if (statsErr) throw new Error(`Statistiques indisponibles : ${statsErr.message}`);
      const stats = (Array.isArray(statsData) ? statsData[0] : statsData) as {
        total_file: number;
        total_indexables: number;
        total_orphelins: number;
      };

      const totalFile = Number(stats?.total_file ?? 0);
      const orphelins = Number(stats?.total_orphelins ?? 0);
      const plafond = Math.max(PURGE_PLANCHER, Math.floor((totalFile * SEUIL_PURGE_PCT) / 100));

      if (orphelins > plafond) {
        purgeRefusee =
          `Purge refusée : ${orphelins} entrées orphelines sur ${totalFile} (plafond ${plafond}). ` +
          `Vérifier le recensement avant d'effacer.`;
        console.error(`[prerender-reconcile] ${purgeRefusee}`);
      } else if (orphelins > 0 && !dryRun) {
        for (let i = 0; i < Math.ceil(orphelins / PURGE_CHUNK) + 1; i++) {
          const { data: lot, error: lotErr } = await admin.rpc("prerender_orphelins", {
            p_limit: PURGE_CHUNK,
          });
          if (lotErr) throw new Error(`Lecture des orphelins impossible : ${lotErr.message}`);
          const rows = (lot ?? []) as { id: string; url_path: string; storage_path: string | null }[];
          if (rows.length === 0) break;

          const chemins = rows.map((r) => r.storage_path).filter((p): p is string => !!p);
          if (chemins.length > 0) {
            const { error: rmErr } = await admin.storage.from(BUCKET).remove(chemins);
            if (rmErr) console.error("[prerender-reconcile] suppression bucket partielle", rmErr.message);
          }

          const { error: delErr } = await admin
            .from("prerender_queue")
            .delete()
            .in("id", rows.map((r) => r.id));
          if (delErr) throw new Error(`Suppression des entrées impossible : ${delErr.message}`);

          purgees += rows.length;
          if (Date.now() - startedAt > BUDGET_MS) break;
        }
      } else if (orphelins > 0 && dryRun) {
        purgeRefusee = `dry_run : ${orphelins} entrées auraient été purgées.`;
      }
    }

    const { count: restantes } = await admin
      .from("prerender_queue")
      .select("id", { count: "exact", head: true })
      .eq("statut", "a_traiter");

    return json({
      ok: true,
      termine: true,
      tranches,
      recensees,
      ajoutees,
      remises,
      inchangees,
      purgees,
      ...(purgeRefusee ? { purge_refusee: purgeRefusee } : {}),
      restantes: restantes ?? 0,
      duree_ms: Date.now() - startedAt,
      ...(dryRun ? { dry_run: true } : {}),
    });
  } catch (e) {
    return json(
      {
        ok: false,
        message: e instanceof Error ? e.message : String(e),
        tranches,
        recensees,
        ajoutees,
        remises,
        inchangees,
        purgees,
      },
      500,
    );
  }
});
