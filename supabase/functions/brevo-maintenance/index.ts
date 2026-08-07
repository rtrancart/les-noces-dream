import { brevoFetch } from "../_shared/brevo-client.ts";

Deno.serve(async (req) => {
  const { email } = await req.json();
  try {
    await brevoFetch(`/contacts/${encodeURIComponent(email)}`, { method: "DELETE" }, { retries: 0 });
    return new Response(JSON.stringify({ ok: true }));
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, message: String(e) }), { status: 200 });
  }
});
