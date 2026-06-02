// auth-verify-email-token — Verifies a custom invitation JWT, marks it consumed,
// and opens a Supabase session for the prestataire.
//
// Flow:
//   1. Client POSTs { token } from /accept-invitation page (deliberate user action,
//      not a passive GET — immune to Gmail/Outlook link scanners).
//   2. We verify the HMAC signature + exp using MAGIC_LINK_SECRET.
//   3. We atomically mark the jti as consumed (UPDATE ... WHERE consumed_at IS NULL
//      RETURNING). If 0 rows updated → already consumed.
//   4. We generate a fresh Supabase magiclink server-side and exchange it for a
//      session via /verify, then return the tokens to the client.
//
// Security:
//   - Returns access_token + refresh_token to the verified user only.
//   - Never exposes service_role to the client.
//   - jti single-use prevents replay even if the JWT leaks.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyInvitationToken } from "../_shared/invitation-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return json({ error: "missing_token" }, 400);
    }

    // 1. Verify signature + expiration
    let payload;
    try {
      payload = await verifyInvitationToken(token);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (/exp|expired/i.test(msg)) return json({ error: "token_expired" }, 401);
      return json({ error: "token_invalid", detail: msg }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // 2. Atomic single-use check
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = req.headers.get("user-agent") ?? null;

    const { data: consumed, error: consumeErr } = await admin
      .from("invitation_tokens")
      .update({ consumed_at: new Date().toISOString(), ip_consumed: ip, user_agent_consumed: ua })
      .eq("jti", payload.jti)
      .is("consumed_at", null)
      .select("jti, user_id, expires_at")
      .maybeSingle();

    if (consumeErr) {
      console.error("[auth-verify] db_error", { jti: payload.jti, err: consumeErr.message });
      return json({ error: "db_error", detail: consumeErr.message }, 500);
    }
    if (!consumed) {
      const { data: existing } = await admin
        .from("invitation_tokens")
        .select("consumed_at")
        .eq("jti", payload.jti)
        .maybeSingle();
      if (existing?.consumed_at) {
        console.error("[auth-verify] token_consumed", { jti: payload.jti });
        return json({ error: "token_consumed" }, 409);
      }
      console.error("[auth-verify] token_unknown", { jti: payload.jti });
      return json({ error: "token_unknown" }, 404);
    }
    if (new Date(consumed.expires_at).getTime() < Date.now()) {
      console.error("[auth-verify] token_expired", { jti: payload.jti });
      return json({ error: "token_expired" }, 401);
    }

    // 3. Resolve the user's email and open a session via magiclink → verifyOtp
    const { data: userResp, error: userErr } = await admin.auth.admin.getUserById(payload.sub);
    if (userErr || !userResp?.user?.email) {
      console.error("[auth-verify] user_not_found", { jti: payload.jti, err: userErr?.message });
      return json({ error: "user_not_found" }, 404);
    }
    const email = userResp.user.email;

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr || !linkData) {
      console.error("[auth-verify] session_generation_failed", { jti: payload.jti, err: linkErr?.message });
      return json({ error: "session_generation_failed", detail: linkErr?.message }, 500);
    }

    const hashedToken = (linkData.properties as any)?.hashed_token;
    if (!hashedToken) {
      console.error("[auth-verify] session_generation_failed: no hashed_token", { jti: payload.jti });
      return json({ error: "session_generation_failed", detail: "no hashed_token" }, 500);
    }

    // Exchange the magiclink hashed_token for a real session using the SDK.
    // Must use token_hash (not token+email) per Supabase Auth v2 API.
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const anon = createClient(supabaseUrl, anonKey);
    const { data: sessionData, error: verifyErr } = await anon.auth.verifyOtp({
      type: "magiclink",
      token_hash: hashedToken,
    });
    if (verifyErr || !sessionData?.session) {
      console.error("[auth-verify] session_exchange_failed", { jti: payload.jti, err: verifyErr?.message });
      return json({ error: "session_exchange_failed", detail: verifyErr?.message ?? "no session" }, 500);
    }

    // 4. Log
    await admin.from("logs_admin").insert({
      admin_id: payload.sub,
      action: "invitation_acceptee",
      entite: "prestataires",
      entite_id: payload.presta_id,
      details: { jti: payload.jti, ip, ua },
    }).then(() => {}, () => {});

    return json({
      success: true,
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      user: { id: payload.sub, email },
      prestataire_id: payload.presta_id,
    });
  } catch (e: any) {
    console.error("[auth-verify] unexpected", { err: String(e?.message ?? e) });
    return json({ error: "unexpected", detail: String(e?.message ?? e) }, 500);
  }
});

