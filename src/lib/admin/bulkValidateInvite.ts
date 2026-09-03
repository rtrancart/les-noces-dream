// Action groupée "Valider & inviter" sur les fiches prestataires importées.
//
// Séparation nette entre :
//   - l'intention (buildBulkIntents) : ce que l'admin veut faire, forme pure
//     dérivée d'une sélection de fiches.
//   - l'exécution (executeIntent / runBulkValidateInvite) : la mécanique
//     d'envoi effective, aujourd'hui synchrone et séquentielle. Cette couche
//     sera plus tard remplacée par un scheduler (file d'attente + worker)
//     pour lisser l'envoi des emails dans le temps, sans rien changer à
//     l'UI ni au producteur d'intentions.
//
// Aucune règle métier n'est ré-implémentée ici : la validation réutilise
// exactement le chemin existant (update statut='validee' → trigger DB
// éventuel flip vers 'actif' → email de publication), et l'invitation
// réutilise l'edge function invite-prestataire avec long_ttl=true (garde-fou
// serveur : origine='migration').

import { supabase } from "@/integrations/supabase/client";
import { logAdmin } from "@/lib/logAdmin";
import type { Database } from "@/integrations/supabase/types";

type Prestataire = Database["public"]["Tables"]["prestataires"]["Row"];
type StatutPrestataire = Database["public"]["Enums"]["statut_prestataire"];

/**
 * Garde-fous de campagne — envoi de masse ponctuel (parc migré).
 * Le débit de livraison réel reste piloté par `email_send_state`
 * (batch_size / send_delay_ms) côté worker `process-email-queue` ;
 * ces constantes bornent seulement l'alimentation de la file.
 */
export const BULK_MAX_PER_RUN = 200;
export const BULK_CHUNK_SIZE = 10;
export const BULK_CHUNK_DELAY_MS = 3000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type BulkIneligibilityReason =
  | "email_manquant"
  | "email_supprime"
  | "statut_non_eligible"
  | "origine_non_migration";

/**
 * @param suppressedEmails ensemble (minuscules) des adresses présentes dans
 * `suppressed_emails` — bounce, plainte ou désinscription. Une adresse morte
 * n'est plus re-sollicitée.
 */
export function getIneligibilityReason(
  p: Prestataire,
  suppressedEmails?: Set<string>,
): BulkIneligibilityReason | null {
  if (!p.email_contact || !p.email_contact.trim()) return "email_manquant";
  if (suppressedEmails?.has(p.email_contact.trim().toLowerCase())) return "email_supprime";
  if (p.statut === "actif" || p.statut === "archive" || p.statut === "resilie_expire") {
    return "statut_non_eligible";
  }
  if ((p as any).origine !== "migration") return "origine_non_migration";
  return null;
}

export function ineligibilityLabel(r: BulkIneligibilityReason): string {
  switch (r) {
    case "email_manquant": return "email de contact manquant";
    case "email_supprime": return "email rejeté (bounce, plainte ou désinscription) — adresse mise de côté";
    case "statut_non_eligible": return "statut non éligible (déjà actif, archivé ou résilié)";
    case "origine_non_migration": return "fiche non issue de la migration (invitation longue durée réservée à la campagne)";
  }
}


// ---------- Intention ----------

export interface BulkIntent {
  prestataireId: string;
  nomCommercial: string;
  actions: Array<"validate" | "invite">;
}

/**
 * Producteur d'intentions — pur.
 * Retourne une intention par fiche éligible. Les fiches non éligibles sont
 * omises ici mais rapportées à l'appelant via `skipped`.
 */
export function buildBulkIntents(prestataires: Prestataire[], suppressedEmails?: Set<string>): {
  intents: BulkIntent[];
  skipped: Array<{ id: string; nomCommercial: string; reason: BulkIneligibilityReason }>;
} {
  const intents: BulkIntent[] = [];
  const skipped: Array<{ id: string; nomCommercial: string; reason: BulkIneligibilityReason }> = [];
  for (const p of prestataires) {
    const reason = getIneligibilityReason(p, suppressedEmails);
    if (reason) {
      skipped.push({ id: p.id, nomCommercial: p.nom_commercial, reason });
      continue;
    }
    intents.push({
      prestataireId: p.id,
      nomCommercial: p.nom_commercial,
      actions: ["validate", "invite"],
    });
  }
  return { intents, skipped };
}

// ---------- Rapport ----------

export type StepOutcome = "ok" | "error" | "skipped";

export interface BulkItemResult {
  id: string;
  nomCommercial: string;
  validation: StepOutcome;
  invitation: StepOutcome;
  finalStatut?: StatutPrestataire;
  /** Échéance d'exemption de charte appliquée (90 j) le cas échéant. */
  exemptionJusqua?: string;

  errors: string[];
}

export interface BulkReport {
  /** Identifiant du run, repris dans logs_admin pour la trace de cadence. */
  runId?: string;
  /** Run interrompu par l'admin entre deux sous-lots. */
  cancelled?: boolean;
  /** Fiches éligibles non traitées (run annulé). */
  notProcessed?: number;
  results: BulkItemResult[];
  totals: {
    total: number;
    fullSuccess: number;
    partialSuccess: number;
    failed: number;
    skipped: number;
  };
}

// ---------- Exécution ----------

/**
 * Exécute une intention. Chaîne validation puis invitation ; si la
 * validation échoue, l'invitation n'est pas tentée (fiche laissée dans son
 * état d'origine côté prestataires).
 *
 * Point d'extension futur : remplacer cette fonction par un enqueue vers
 * une table de campagne (validation immédiate, invitation lissée dans le
 * temps par un worker). L'UI et buildBulkIntents restent inchangés.
 */
export async function executeIntent(intent: BulkIntent): Promise<BulkItemResult> {
  const result: BulkItemResult = {
    id: intent.prestataireId,
    nomCommercial: intent.nomCommercial,
    validation: "skipped",
    invitation: "skipped",
    errors: [],
  };

  // 1) Validation — RPC dédiée aux fiches migrées : pose une exemption de
  //    charte de 90 jours (si aucune n'existe) puis passe la fiche en
  //    'validee'. Le trigger DB flip ensuite vers 'actif' (exemption valide).
  try {
    const { data: rows, error } = await supabase
      .rpc("valider_prestataire_migre", { p_prestataire_id: intent.prestataireId });
    if (error) throw error;
    const updated = Array.isArray(rows) ? rows[0] : rows;
    if (!updated) throw new Error("Prestataire introuvable après mise à jour");
    result.validation = "ok";
    result.finalStatut = updated.statut as StatutPrestataire;
    result.exemptionJusqua = updated.charte_exemptee_jusqua ?? undefined;
    logAdmin("update_statut_prestataire", "prestataires", intent.prestataireId, {
      statut: "validee",
      bulk: true,
      charte_exemptee_jusqua: updated.charte_exemptee_jusqua,
    });


    // Le trigger DB peut flip vers 'actif' si charte signée / exemption valide.
    // Dans ce cas, envoyer l'email de publication (même logique que
    // updateStatut individuel).
    if (updated.statut === "actif") {
      let recipient = updated.email_contact;
      let prenom = "";
      if (updated.user_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("email, prenom")
          .eq("id", updated.user_id)
          .maybeSingle();
        if (prof?.email) recipient = prof.email;
        prenom = prof?.prenom ?? "";
      }
      if (recipient) {
        const siteUrl = window.location.origin;
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "validation_publication_fiche",
            recipientEmail: recipient,
            idempotencyKey: `publication-${intent.prestataireId}`,
            templateData: {
              prenom,
              nom_commercial: updated.nom_commercial,
              lien_fiche_publique: `${siteUrl}/prestataire/${updated.slug}`,
              lien_dashboard: `${siteUrl}/espace-pro`,
            },
          },
        });
      }
    }
  } catch (e: any) {
    result.validation = "error";
    result.errors.push(`Validation: ${e?.message ?? String(e)}`);
    return result; // On n'envoie pas l'invitation si la validation a échoué.
  }

  // 2) Invitation — edge function existante, long_ttl=true.
  try {
    const { data: pRaw, error: fetchErr } = await supabase
      .from("prestataires")
      .select("*")
      .eq("id", intent.prestataireId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!pRaw) throw new Error("Prestataire introuvable pour l'invitation");
    const p = pRaw as any;

    // prenom/nom du contact = profil lié à user_id (comme dans openEdit).
    let prenomContact: string | null = null;
    let nomContact: string | null = null;
    if (p.user_id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("prenom, nom")
        .eq("id", p.user_id)
        .maybeSingle();
      prenomContact = prof?.prenom ?? null;
      nomContact = prof?.nom ?? null;
    }

    const { data, error } = await supabase.functions.invoke("invite-prestataire", {
      body: {
        prestataire_id: p.id,
        email: p.email_contact,
        prenom: prenomContact,
        nom: nomContact,
        nom_commercial: p.nom_commercial,
        telephone: p.telephone,
        categorie_mere_id: p.categorie_mere_id,
        categorie_fille_id: p.categorie_fille_id || null,
        ville: p.ville,
        region: p.region,
        code_postal: p.code_postal || null,
        description: p.description || null,
        description_courte: p.description_courte || null,
        notes_pre_inscription: p.notes_pre_inscription || null,
        long_ttl: true,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    result.invitation = "ok";
  } catch (e: any) {
    result.invitation = "error";
    result.errors.push(`Invitation: ${e?.message ?? String(e)}`);
  }

  return result;
}

/** Erreur levée quand la sélection dépasse le plafond de sécurité par run. */
export class BulkCapExceededError extends Error {
  constructor(public readonly selected: number) {
    super(
      `Sélection de ${selected} fiches — maximum ${BULK_MAX_PER_RUN} par lancement. ` +
      `Procédez par lots de ${BULK_MAX_PER_RUN} au maximum.`,
    );
    this.name = "BulkCapExceededError";
  }
}

/**
 * Orchestre le traitement d'une liste d'intentions.
 *
 * Garde-fous campagne :
 *  - plafond dur `BULK_MAX_PER_RUN` : au-delà, refus explicite (jamais de
 *    troncature silencieuse) ;
 *  - lissage : sous-lots de `BULK_CHUNK_SIZE` fiches séparés par
 *    `BULK_CHUNK_DELAY_MS`, pour alimenter la file pgmq progressivement ;
 *  - annulation possible entre deux sous-lots via `shouldCancel()` ;
 *  - journalisation de cadence dans `logs_admin` (volumes, durée, débit,
 *    paramètres `email_send_state` en vigueur au démarrage du run).
 */
export async function runBulkValidateInvite(opts: {
  prestataires: Prestataire[];
  suppressedEmails?: Set<string>;
  onProgress?: (done: number, total: number, last: BulkItemResult) => void;
  shouldCancel?: () => boolean;
}): Promise<BulkReport> {
  const selected = opts.prestataires.length;
  if (selected > BULK_MAX_PER_RUN) throw new BulkCapExceededError(selected);

  const { intents, skipped } = buildBulkIntents(opts.prestataires, opts.suppressedEmails);

  // Paramètres de débit en vigueur (lecture seule, pour la trace de cadence).
  let sendState: { batch_size: number | null; send_delay_ms: number | null } | null = null;
  try {
    const { data } = await supabase
      .from("email_send_state")
      .select("batch_size, send_delay_ms")
      .maybeSingle();
    sendState = data ?? null;
  } catch {
    // Trace best-effort — ne doit jamais bloquer l'envoi.
  }

  const runId = crypto.randomUUID();
  const startedAt = new Date();
  const results: BulkItemResult[] = [];
  let cancelled = false;

  for (let i = 0; i < intents.length; i++) {
    if (i > 0 && i % BULK_CHUNK_SIZE === 0) {
      if (opts.shouldCancel?.()) { cancelled = true; break; }
      await sleep(BULK_CHUNK_DELAY_MS);
      if (opts.shouldCancel?.()) { cancelled = true; break; }
    }
    const r = await executeIntent(intents[i]);
    results.push(r);
    opts.onProgress?.(i + 1, intents.length, r);
  }

  let fullSuccess = 0, partialSuccess = 0, failed = 0;
  for (const r of results) {
    if (r.validation === "ok" && r.invitation === "ok") fullSuccess++;
    else if (r.validation === "ok" && r.invitation === "error") partialSuccess++;
    else failed++;
  }

  const notProcessed = intents.length - results.length;

  const report: BulkReport = {
    runId,
    cancelled,
    notProcessed,
    results,
    skipped,
    totals: {
      total: results.length + skipped.length,
      fullSuccess,
      partialSuccess,
      failed,
      skipped: skipped.length,
    },
  };

  const finishedAt = new Date();
  const dureeMs = finishedAt.getTime() - startedAt.getTime();
  const invitationsEnvoyees = fullSuccess;

  await logAdmin("bulk_validate_invite", "prestataires", undefined, {
    run_id: runId,
    demarre_le: startedAt.toISOString(),
    termine_le: finishedAt.toISOString(),
    duree_ms: dureeMs,
    selection: selected,
    traitees: results.length,
    non_traitees: notProcessed,
    invitations_envoyees: invitationsEnvoyees,
    debit_invitations_par_min: dureeMs > 0
      ? Math.round((invitationsEnvoyees / dureeMs) * 60000 * 10) / 10
      : null,
    chunk_size: BULK_CHUNK_SIZE,
    chunk_delay_ms: BULK_CHUNK_DELAY_MS,
    max_per_run: BULK_MAX_PER_RUN,
    email_send_batch_size: sendState?.batch_size ?? null,
    email_send_delay_ms: sendState?.send_delay_ms ?? null,
    annule: cancelled,
    total: report.totals.total,
    full_success: report.totals.fullSuccess,
    partial_success: report.totals.partialSuccess,
    failed: report.totals.failed,
    skipped: report.totals.skipped,
  });

  return report;
}

export function formatReportAsText(report: BulkReport): string {
  const lines: string[] = [];
  lines.push(`Rapport action groupée « Valider & inviter »`);
  lines.push(`Total : ${report.totals.total} — succès complets : ${report.totals.fullSuccess}, partiels : ${report.totals.partialSuccess}, échecs : ${report.totals.failed}, ignorés : ${report.totals.skipped}`);
  lines.push("");
  for (const r of report.results) {
    const icon = r.validation === "ok" && r.invitation === "ok" ? "✓"
      : r.validation === "ok" && r.invitation === "error" ? "⚠"
      : "✗";
    const detail = r.errors.length ? ` — ${r.errors.join(" | ")}` : "";
    const exemption = r.exemptionJusqua
      ? ` — charte à signer avant le ${new Date(r.exemptionJusqua).toLocaleDateString("fr-FR")}`
      : "";
    lines.push(`${icon} ${r.nomCommercial}${exemption}${detail}`);

  }
  for (const s of report.skipped) {
    lines.push(`⊘ ${s.nomCommercial} — ignorée (${ineligibilityLabel(s.reason)})`);
  }
  return lines.join("\n");
}
