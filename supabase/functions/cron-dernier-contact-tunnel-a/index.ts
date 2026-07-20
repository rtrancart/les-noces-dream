// Cron J+14 — Tunnel A : dernier contact aux prestataires invités par un admin
// qui n'ont toujours pas activé leur compte, 14 jours après l'envoi initial.
// Sélection : statut = 'pre_inscrit', magic_link_envoye_le <= now() - 14 j,
// premier_login_le IS NULL, dernier_contact_tunnel_a_envoye_le IS NULL.
// Aucun email suivant. Verrou idempotent : update AVANT enqueue.
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

  const cutoff = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from("prestataires")
    .select("id, user_id, email_contact, nom_commercial, origine, magic_link_envoye_le")
    .eq("statut", "pre_inscrit")
    .is("premier_login_le", null)
    .not("magic_link_envoye_le", "is", null)
    .lte("magic_link_envoye_le", cutoff)
    .is("dernier_contact_tunnel_a_envoye_le", null);

  if (error) {
    console.error("cron-dernier-contact-tunnel-a: query error", error);
    return json({ error: error.message }, 500);
  }

  let sent = 0;
  let skipped = 0;
  for (const row of rows ?? []) {
    // Verrou idempotent : update préalable avec garde .is(null).
    const { data: locked, error: lockErr } = await supabase
      .from("prestataires")
      .update({ dernier_contact_tunnel_a_envoye_le: new Date().toISOString() })
      .eq("id", row.id)
      .is("dernier_contact_tunnel_a_envoye_le", null)
      .select("id");
    if (lockErr) {
      console.warn("cron-dernier-contact-tunnel-a: lock update failed", row.id, lockErr);
      continue;
    }
    if (!locked || locked.length === 0) {
      skipped++;
      continue;
    }

    try {
      if (!row.email_contact || !row.user_id) {
        console.warn("cron-dernier-contact-tunnel-a: missing email_contact or user_id", row.id);
        continue;
      }

      // Nouveau magic link frais — TTL 60 j si migration, sinon 14 j pour laisser
      // une fenêtre confortable après ce dernier contact.
      const ttlSeconds = row.origine === "migration"
        ? 60 * 60 * 24 * 60
        : 60 * 60 * 24 * 14;
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
        console.error("cron-dernier-contact-tunnel-a: token insert failed", row.id, tokenErr);
        continue;
      }
      const magicLink = `${SITE_URL}/accept-invitation?token=${token}`;

      const subject = encodeURIComponent("Retrait de mon profil LesNoces.net");
      const body = encodeURIComponent(
        `Bonjour,\n\nJe souhaite que mon profil (${row.nom_commercial ?? ""}) soit retiré de LesNoces.net.\n\nMerci.`,
      );
      const lienRetrait = `mailto:contact@lesnoces.net?subject=${subject}&body=${body}`;

      let prenom: string | undefined;
      const { data: profile } = await supabase
        .from("profiles")
        .select("prenom")
        .eq("id", row.user_id)
        .maybeSingle();
      prenom = profile?.prenom ?? undefined;

      const idempotencyKey = `dernier-contact-tunnel-a-${row.id}-${row.magic_link_envoye_le}`;

      const { error: invokeErr } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "dernier_contact_tunnel_a",
          recipientEmail: row.email_contact,
          idempotencyKey,
          templateData: {
            prenom,
            nom_commercial: row.nom_commercial ?? undefined,
            magic_link: magicLink,
            lien_retrait: lienRetrait,
          },
        },
      });
      if (invokeErr) {
        console.error("cron-dernier-contact-tunnel-a: invoke error", row.id, invokeErr);
      } else {
        sent++;
      }
    } catch (e) {
      console.error("cron-dernier-contact-tunnel-a: send failed", row.id, e);
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
