// Cron J+7 — Tunnel A : relance des prestataires invités par un admin qui
// n'ont toujours pas activé leur compte.
// Sélection : statut = 'pre_inscrit', magic_link_envoye_le <= now() - 7 j,
// premier_login_le IS NULL, relance_decouverte_j7_envoye_le IS NULL.
// L'update DB est fait AVANT enqueue (verrou idempotent).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { signInvitationToken } from "../_shared/invitation-token.ts";

const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://lesnoces.net";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from("prestataires")
    .select("id, user_id, email_contact, nom_commercial, origine, magic_link_envoye_le")
    .eq("statut", "pre_inscrit")
    .is("premier_login_le", null)
    .not("magic_link_envoye_le", "is", null)
    .lte("magic_link_envoye_le", cutoff)
    .is("relance_decouverte_j7_envoye_le", null);

  if (error) {
    console.error("cron-relance-decouverte-j7: query error", error);
    return json({ error: error.message }, 500);
  }

  let sent = 0;
  let skipped = 0;
  for (const row of rows ?? []) {
    // Verrou idempotent : update préalable avec garde .is(null).
    const { data: locked, error: lockErr } = await supabase
      .from("prestataires")
      .update({ relance_decouverte_j7_envoye_le: new Date().toISOString() })
      .eq("id", row.id)
      .is("relance_decouverte_j7_envoye_le", null)
      .select("id");
    if (lockErr) {
      console.warn("cron-relance-decouverte-j7: lock update failed", row.id, lockErr);
      continue;
    }
    if (!locked || locked.length === 0) {
      skipped++;
      continue;
    }

    try {
      if (!row.email_contact || !row.user_id) {
        console.warn("cron-relance-decouverte-j7: missing email_contact or user_id", row.id);
        continue;
      }

      // Nouveau magic link frais (le premier a pu expirer).
      // TTL 60 j si origine 'migration', sinon 7 j (aligné sur invite-prestataire).
      const ttlSeconds = row.origine === "migration"
        ? 60 * 60 * 24 * 60
        : 60 * 60 * 24 * 7;
      const { token, jti, expiresAt } = await signInvitationToken({
        userId: row.user_id,
        prestataireId: row.id,
        ttlSeconds,
      });
      const { error: tokenErr } = await supabase.from("invitation_tokens").insert({
        jti,
        user_id: row.user_id,
        prestataire_id: row.id,
        action: "accept_invitation",
        expires_at: expiresAt.toISOString(),
      });
      if (tokenErr) {
        console.error("cron-relance-decouverte-j7: token insert failed", row.id, tokenErr);
        continue;
      }
      const magicLink = `${SITE_URL}/accept-invitation?token=${token}`;

      let prenom: string | undefined;
      const { data: profile } = await supabase
        .from("profiles")
        .select("prenom")
        .eq("id", row.user_id)
        .maybeSingle();
      prenom = profile?.prenom ?? undefined;

      const idempotencyKey = `relance-decouverte-j7-${row.id}-${row.magic_link_envoye_le}`;

      const { error: invokeErr } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "relance_decouverte_j7",
          recipientEmail: row.email_contact,
          idempotencyKey,
          templateData: {
            prenom,
            nom_commercial: row.nom_commercial ?? undefined,
            magic_link: magicLink,
          },
        },
      });
      if (invokeErr) {
        console.error("cron-relance-decouverte-j7: invoke error", row.id, invokeErr);
      } else {
        sent++;
      }
    } catch (e) {
      console.error("cron-relance-decouverte-j7: send failed", row.id, e);
    }
  }

  return json({ ok: true, candidates: rows?.length ?? 0, sent, skipped });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
