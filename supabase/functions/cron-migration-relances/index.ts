// Chaîne « prestataires migrés » — relances M-02 → M-05.
// Fonction unique paramétrée : ?step=m02|m03|m04|m05 (ou {"step":"m02"} en body).
// Modèle : cron-relance-decouverte-j7 (verrou idempotent avant enqueue).
//
// Prédicats :
//   m02/m03/m04 : origine='migration', magic_link_envoye_le <= now()-5|10|15 j,
//                 premier_login_le IS NULL, jalon correspondant IS NULL
//   m05         : origine='migration', premier_login_le <= now()-3 j,
//                 charte_signee_le IS NULL, migration_m05_envoye_le IS NULL
//                 (les fiches exemptées sont la cible : seul critère d'arrêt =
//                  signature de la charte)
//
// JETABILITÉ — désactiver la chaîne en une migration :
//   SELECT cron.unschedule('migration-relances-quotidien');
// Les colonnes de jalon et les entrées email_textes peuvent rester en place.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { signInvitationToken } from "../_shared/invitation-token.ts";

const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://lesnoces.net";

type Step = "m02" | "m03" | "m04" | "m05";

const CONFIG: Record<Step, { column: string; template: string; days: number }> = {
  m02: { column: "migration_m02_envoye_le", template: "migration_m02_relance", days: 5 },
  m03: { column: "migration_m03_envoye_le", template: "migration_m03_relance", days: 10 },
  m04: { column: "migration_m04_envoye_le", template: "migration_m04_relance", days: 15 },
  m05: { column: "migration_m05_envoye_le", template: "migration_m05_charte", days: 3 },
};

function formatDateFr(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(d);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  let step = url.searchParams.get("step") as Step | null;
  if (!step) {
    const body = await req.json().catch(() => ({}));
    step = (body?.step ?? null) as Step | null;
  }
  if (!step || !CONFIG[step]) {
    return json({ error: "step invalide (m02|m03|m04|m05)" }, 400);
  }
  const cfg = CONFIG[step];

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - cfg.days * 24 * 3600 * 1000).toISOString();

  let query = supabase
    .from("prestataires")
    .select(
      "id, user_id, email_contact, nom_commercial, magic_link_envoye_le, premier_login_le, charte_exemptee_jusqua",
    )
    .eq("origine", "migration")
    .is(cfg.column, null);

  if (step === "m05") {
    query = query
      .not("premier_login_le", "is", null)
      .lte("premier_login_le", cutoff)
      .is("charte_signee_le", null);
  } else {
    query = query
      .is("premier_login_le", null)
      .not("magic_link_envoye_le", "is", null)
      .lte("magic_link_envoye_le", cutoff);
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error(`cron-migration-relances[${step}]: query error`, error);
    return json({ error: error.message }, 500);
  }

  let sent = 0;
  let skipped = 0;
  for (const row of rows ?? []) {
    // Verrou idempotent : jalon posé AVANT enqueue, avec garde .is(null).
    const { data: locked, error: lockErr } = await supabase
      .from("prestataires")
      .update({ [cfg.column]: new Date().toISOString() })
      .eq("id", row.id)
      .is(cfg.column, null)
      .select("id");
    if (lockErr) {
      console.warn(`cron-migration-relances[${step}]: lock failed`, row.id, lockErr);
      continue;
    }
    if (!locked || locked.length === 0) {
      skipped++;
      continue;
    }

    try {
      if (!row.email_contact || !row.user_id) {
        console.warn(`cron-migration-relances[${step}]: missing email_contact/user_id`, row.id);
        continue;
      }

      const templateData: Record<string, unknown> = {
        nom_commercial: row.nom_commercial ?? undefined,
      };

      if (step === "m05") {
        templateData.charte_url = `${SITE_URL}/signer-la-charte`;
        templateData.charte_exemptee_jusqua = formatDateFr(row.charte_exemptee_jusqua);
      } else {
        // Magic link frais (le précédent a pu expirer) — TTL 60 j (fiches migrées).
        const { token, jti, expiresAt } = await signInvitationToken({
          userId: row.user_id,
          prestataireId: row.id,
          ttlSeconds: 60 * 60 * 24 * 60,
        });
        const { error: tokenErr } = await supabase.from("invitation_tokens").insert({
          jti,
          user_id: row.user_id,
          prestataire_id: row.id,
          action: "accept_invitation",
          expires_at: expiresAt.toISOString(),
        });
        if (tokenErr) {
          console.error(`cron-migration-relances[${step}]: token insert failed`, row.id, tokenErr);
          continue;
        }
        templateData.magic_link = `${SITE_URL}/accept-invitation?token=${token}`;
      }

      const anchor = step === "m05" ? row.premier_login_le : row.magic_link_envoye_le;
      const idempotencyKey = `migration-${step}-${row.id}-${anchor}`;

      const { error: invokeErr } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: cfg.template,
          recipientEmail: row.email_contact,
          idempotencyKey,
          templateData,
        },
      });
      if (invokeErr) {
        console.error(`cron-migration-relances[${step}]: invoke error`, row.id, invokeErr);
      } else {
        sent++;
      }
    } catch (e) {
      console.error(`cron-migration-relances[${step}]: send failed`, row.id, e);
    }
  }

  return json({ ok: true, step, candidates: rows?.length ?? 0, sent, skipped });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
