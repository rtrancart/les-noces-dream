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

export type BulkIneligibilityReason =
  | "email_manquant"
  | "statut_non_eligible"
  | "origine_non_migration";

export function getIneligibilityReason(p: Prestataire): BulkIneligibilityReason | null {
  if (!p.email_contact || !p.email_contact.trim()) return "email_manquant";
  if (p.statut === "actif" || p.statut === "archive" || p.statut === "resilie_expire") {
    return "statut_non_eligible";
  }
  if ((p as any).origine !== "migration") return "origine_non_migration";
  return null;
}

export function ineligibilityLabel(r: BulkIneligibilityReason): string {
  switch (r) {
    case "email_manquant": return "email de contact manquant";
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
export function buildBulkIntents(prestataires: Prestataire[]): {
  intents: BulkIntent[];
  skipped: Array<{ id: string; nomCommercial: string; reason: BulkIneligibilityReason }>;
} {
  const intents: BulkIntent[] = [];
  const skipped: Array<{ id: string; nomCommercial: string; reason: BulkIneligibilityReason }> = [];
  for (const p of prestataires) {
    const reason = getIneligibilityReason(p);
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
  errors: string[];
}

export interface BulkReport {
  results: BulkItemResult[];
  skipped: Array<{ id: string; nomCommercial: string; reason: BulkIneligibilityReason }>;
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

  // 1) Validation — même chemin que la validation manuelle individuelle.
  try {
    const { data: updated, error } = await supabase
      .from("prestataires")
      .update({ statut: "validee" as StatutPrestataire })
      .eq("id", intent.prestataireId)
      .select("id, nom_commercial, slug, statut, user_id, email_contact")
      .maybeSingle();
    if (error) throw error;
    if (!updated) throw new Error("Prestataire introuvable après mise à jour");
    result.validation = "ok";
    result.finalStatut = updated.statut as StatutPrestataire;
    logAdmin("update_statut_prestataire", "prestataires", intent.prestataireId, {
      statut: "validee",
      bulk: true,
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

/**
 * Orchestre le traitement d'une liste d'intentions. Séquentiel (une fiche
 * à la fois) pour préserver la lisibilité du rapport et éviter de saturer
 * le back-office pendant un run manuel. Un run par lots est de toute façon
 * borné par la taille de la page courante.
 */
export async function runBulkValidateInvite(opts: {
  prestataires: Prestataire[];
  onProgress?: (done: number, total: number, last: BulkItemResult) => void;
}): Promise<BulkReport> {
  const { intents, skipped } = buildBulkIntents(opts.prestataires);
  const results: BulkItemResult[] = [];
  for (let i = 0; i < intents.length; i++) {
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

  const report: BulkReport = {
    results,
    skipped,
    totals: {
      total: intents.length + skipped.length,
      fullSuccess,
      partialSuccess,
      failed,
      skipped: skipped.length,
    },
  };

  await logAdmin("bulk_validate_invite", "prestataires", undefined, {
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
    lines.push(`${icon} ${r.nomCommercial}${detail}`);
  }
  for (const s of report.skipped) {
    lines.push(`⊘ ${s.nomCommercial} — ignorée (${ineligibilityLabel(s.reason)})`);
  }
  return lines.join("\n");
}
