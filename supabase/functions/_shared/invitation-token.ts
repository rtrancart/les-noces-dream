// Custom signed token for prestataire invitations.
// HMAC-SHA256 via Deno's standard djwt library.
// Why custom and not Supabase magic link?
//   1. Gmail/Outlook scanners pre-fetch magic link URLs and consume the
//      one-time Supabase token before the user clicks → "link expired".
//   2. We control the entire lifecycle (storage in invitation_tokens table,
//      single-use jti, expiration, replay protection).
//   3. The token is NOT a Supabase token. A GET from a scanner cannot
//      create a session — only a deliberate POST from /accept-invitation
//      consumes it.
import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const ALG = { name: "HMAC", hash: "SHA-256" } as const;

async function getKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("MAGIC_LINK_SECRET");
  if (!secret) throw new Error("MAGIC_LINK_SECRET is not configured");
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    ALG,
    false,
    ["sign", "verify"],
  );
}

export interface InvitationTokenPayload {
  sub: string;            // user_id
  presta_id: string;      // prestataire_id
  action: "accept_invitation";
  jti: string;            // unique id stored in invitation_tokens
  iat: number;
  exp: number;
  [key: string]: unknown; // index signature required by djwt's Payload
}

export interface SignOpts {
  userId: string;
  prestataireId: string;
  ttlSeconds?: number; // default 7 days
}

export async function signInvitationToken(opts: SignOpts): Promise<{ token: string; jti: string; expiresAt: Date }> {
  const ttl = opts.ttlSeconds ?? 60 * 60 * 24 * 7;
  const jti = crypto.randomUUID();
  const exp = getNumericDate(ttl);
  const payload: InvitationTokenPayload = {
    sub: opts.userId,
    presta_id: opts.prestataireId,
    action: "accept_invitation",
    jti,
    iat: getNumericDate(0),
    exp,
  };
  const key = await getKey();
  const token = await create({ alg: "HS256", typ: "JWT" }, payload, key);
  return { token, jti, expiresAt: new Date(exp * 1000) };
}

export async function verifyInvitationToken(token: string): Promise<InvitationTokenPayload> {
  const key = await getKey();
  const payload = await verify(token, key) as InvitationTokenPayload;
  if (payload.action !== "accept_invitation") {
    throw new Error("invalid_action");
  }
  if (!payload.sub || !payload.jti) {
    throw new Error("invalid_payload");
  }
  return payload;
}
