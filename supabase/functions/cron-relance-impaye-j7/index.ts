// Cron J+7 : relance intermédiaire d'impayé.
// Envoie l'email `impaye_rappel_intermediaire` aux prestataires dont le premier
// échec de paiement date d'au moins 7 jours et qui n'ont pas encore reçu ce rappel.
// L'update DB est fait AVANT l'enqueue, ce qui garantit l'anti-doublon si le cron re-tourne.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://les-noces.lovable.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from("abonnements")
    .select("id, prestataire_id, stripe_subscription_id, premier_echec_le")
    .eq("statut", "en_retard")
    .not("premier_echec_le", "is", null)
    .lte("premier_echec_le", cutoff)
    .is("rappel_impaye_envoye_le", null)
    .is("suspendu_pour_impaye_le", null);

  if (error) {
    console.error("cron-relance-impaye-j7: query error", error);
    return json({ error: error.message }, 500);
  }

  let sent = 0;
  let skipped = 0;
  for (const row of rows ?? []) {
    // Update AVANT enqueue : si un autre run passe en parallèle, seul un update
    // avec `.is('rappel_impaye_envoye_le', null)` réussira (idempotent).
    const { data: locked, error: lockErr } = await supabase
      .from("abonnements")
      .update({ rappel_impaye_envoye_le: new Date().toISOString() })
      .eq("id", row.id)
      .is("rappel_impaye_envoye_le", null)
      .select("id");
    if (lockErr) {
      console.warn("cron-relance-impaye-j7: lock update failed", row.id, lockErr);
      continue;
    }
    if (!locked || locked.length === 0) {
      skipped++;
      continue;
    }

    try {
      const { data: presta } = await supabase
        .from("prestataires")
        .select("email_contact, nom_commercial, user_id")
        .eq("id", row.prestataire_id)
        .maybeSingle();
      if (!presta?.email_contact) {
        console.warn("cron-relance-impaye-j7: no email_contact", row.prestataire_id);
        continue;
      }
      let prenom: string | undefined;
      if (presta.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("prenom")
          .eq("id", presta.user_id)
          .maybeSingle();
        prenom = profile?.prenom ?? undefined;
      }

      const idempotencyKey = `impaye-rappel-${row.prestataire_id}-${row.stripe_subscription_id}-${row.premier_echec_le}`;

      const { error: invokeErr } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "impaye_rappel_intermediaire",
          recipientEmail: presta.email_contact,
          idempotencyKey,
          templateData: {
            prenom,
            nom_commercial: presta.nom_commercial ?? undefined,
            portail_url: `${SITE_URL}/espace-pro/abonnement`,
          },
        },
      });
      if (invokeErr) {
        console.error("cron-relance-impaye-j7: invoke error", row.prestataire_id, invokeErr);
      } else {
        sent++;
      }
    } catch (e) {
      console.error("cron-relance-impaye-j7: send failed", row.prestataire_id, e);
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
