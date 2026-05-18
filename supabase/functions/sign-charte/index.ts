// sign-charte — Authenticated prestataire signs the active Charte Qualité.
//
// PATTERN ASYNCHRONE (cf. trigger prevent_signature_modification, art. 11 Charte) :
//   1. INSERT signatures_charte avec les seules colonnes probatoires (immuables).
//      `pdf_preuve_url` et `email_confirmation_envoye_le` restent NULL.
//   2. Réponse 200 immédiate au prestataire (~50-100 ms).
//   3. Invocation fire-and-forget de `generate-charte-pdf-preuve` qui fera
//      ensuite : UPDATE signatures_charte SET pdf_preuve_url = ?
//               WHERE id = ? AND pdf_preuve_url IS NULL.
//      La clause `IS NULL` est une ceinture en plus du trigger write-once.
//   4. L'envoi email Scaleway fera de même pour `email_confirmation_envoye_le`.
//
// Le trigger DB garantit que ces deux colonnes ne peuvent être renseignées
// qu'une seule fois, et que toutes les autres colonnes sont strictement immuables.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseClientIp(xff: string | null): string | null {
  if (!xff) return null;
  const first = xff.split(",")[0].trim();
  // Basic IPv4 / IPv6 validation
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6 = /^[0-9a-fA-F:]+$/;
  if (ipv4.test(first) || (ipv6.test(first) && first.includes(":"))) return first;
  return null;
}

function buildDraftSlug(userId: string): string {
  return `prestataire-${userId.slice(0, 8)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Non autorisé");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) throw new Error("Non autorisé");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Locate prestataire owned by user
    let { data: presta, error: prestaErr } = await adminClient
      .from("prestataires").select("id, statut, motif_suspension, charte_signee_le").eq("user_id", user.id).maybeSingle();
    if (prestaErr) throw prestaErr;

    // Self-signup accounts receive the prestataire role before the draft fiche exists.
    // Create the minimal private fiche lazily so the signature flow can complete.
    if (!presta) {
      const { data: roleRows, error: roleErr } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (roleErr) throw roleErr;
      const canCreatePrestataire = (roleRows ?? []).some((r) => r.role === "prestataire");
      if (!canCreatePrestataire) throw new Error("Aucune fiche prestataire trouvée pour cet utilisateur");

      const [{ data: profile, error: profileErr }, { data: category, error: categoryErr }] = await Promise.all([
        adminClient.from("profiles").select("prenom, nom, email").eq("id", user.id).maybeSingle(),
        adminClient
          .from("categories")
          .select("id")
          .is("parent_id", null)
          .eq("est_active", true)
          .order("ordre_affichage", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);
      if (profileErr) throw profileErr;
      if (categoryErr) throw categoryErr;
      if (!category) throw new Error("Aucune catégorie active disponible");

      const displayName = [profile?.prenom, profile?.nom].filter(Boolean).join(" ").trim();
      const { data: createdPresta, error: createPrestaErr } = await adminClient
        .from("prestataires")
        .insert({
          user_id: user.id,
          nom_commercial: displayName || "Prestataire à compléter",
          slug: buildDraftSlug(user.id),
          categorie_mere_id: category.id,
          ville: "À compléter",
          region: "À compléter",
          email_contact: profile?.email ?? user.email ?? null,
          statut: "pre_inscrit",
        })
        .select("id, statut, motif_suspension, charte_signee_le")
        .single();
      if (createPrestaErr) throw createPrestaErr;
      presta = createdPresta;
    }

    // Archive verrouillée : magic link expiré ou tentative tardive de signature après archivage J+60
    if (presta.statut === "archive" && presta.motif_suspension === "charte_non_signee") {
      return new Response(
        JSON.stringify({ error: "archive_locked", code: "archive_locked", prestataire_id: presta.id }),
        { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get active charte version
    const { data: charte, error: charteErr } = await adminClient
      .from("chartes_versions").select("*").is("archivee_le", null).maybeSingle();
    if (charteErr) throw charteErr;
    if (!charte) throw new Error("Aucune version de Charte active");

    // Prevent double-signing the same version
    const { data: existing } = await adminClient.from("signatures_charte")
      .select("id").eq("prestataire_id", presta.id).eq("charte_version_id", charte.id).maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ success: true, already_signed: true, signature_id: existing.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ip = parseClientIp(req.headers.get("x-forwarded-for"));
    const ua = req.headers.get("user-agent") ?? "unknown";

    const { data: signature, error: sigError } = await adminClient.from("signatures_charte").insert({
      prestataire_id: presta.id,
      profile_id: user.id,
      charte_version_id: charte.id,
      charte_numero_version: charte.numero_version,
      charte_hash: charte.contenu_hash,
      ip_signataire: ip,
      user_agent: ua,
      methode_auth: "session_supabase",
    }).select().single();
    if (sigError) throw sigError;

    // Clear "charte obsolete" notification flag now that they signed.
    // A self-registered/pre-registered provider must land on a private draft after signing.
    const prestatairePatch: Record<string, unknown> = {
      notification_charte_obsolete_envoyee_le: null,
      motif_suspension: null,
    };
    if (presta.statut === "pre_inscrit") prestatairePatch.statut = "brouillon";

    await adminClient.from("prestataires")
      .update(prestatairePatch)
      .eq("id", presta.id);

    // Async: generate proof PDF (fire and forget)
    adminClient.functions.invoke("generate-charte-pdf-preuve", {
      body: { signature_id: signature.id },
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true, signature_id: signature.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
