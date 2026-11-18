import { next } from "@vercel/edge";

/**
 * Edge Middleware — sert le snapshot pré-rendu aux robots.
 *
 * Pourquoi un middleware et pas un simple rewrite : la passerelle des fonctions
 * du backend remplace, sur toute réponse GET HTML, l'en-tête par
 * `Content-Type: text/plain` + `Content-Security-Policy: default-src 'none'; sandbox`.
 * Un rewrite Vercel transmet ces en-têtes tels quels, et Google ne voit alors
 * qu'un fichier texte. Ici on récupère le HTML et on le renvoie avec les bons
 * en-têtes.
 *
 *   - robot   -> snapshot pré-rendu via prerender-serve (en-têtes HTML rétablis)
 *   - humain  -> comportement inchangé (SPA)
 *
 * En cas de doute ou d'erreur, on laisse passer (fail-open : SPA).
 */

// Même liste de user-agents que les rewrites prerender-serve de vercel.json.
const BOT_UA =
  /(bot|crawler|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|pinterest|whatsapp|telegram|discord|twitter|linkedinbot|applebot|headless|lighthouse|chrome-lighthouse|google-inspectiontool)/i;

// Mêmes exclusions que le rewrite prerender-serve de vercel.json.
const EXCLU =
  /^\/(api\/|assets\/|functions\/|admin(\/|$)|espace-pro(\/|$)|espace-client(\/|$)|connexion(\/|$)|inscription(\/|$)|recherche(\/|$)|auth\/|paiement(\/|$)|checkout(\/|$)|sitemap\.xml|robots\.txt|favicon|.*\.[a-zA-Z0-9]{2,5}$)/;

const PRERENDER_SERVE =
  "https://egbohbwiywgyyculswvf.supabase.co/functions/v1/prerender-serve";

// En-têtes imposés par la passerelle ou propres au transport : jamais recopiés.
const NON_RECOPIES = new Set([
  "content-type",
  "content-security-policy",
  "content-length",
  "content-encoding",
  "transfer-encoding",
  "connection",
  "set-cookie",
]);

export const config = {
  matcher: "/((?!assets/|api/|functions/).*)",
};

export default async function middleware(request: Request) {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") return next();
    const url = new URL(request.url);
    if (url.searchParams.has("__prerender_bypass")) return next();
    if (url.pathname !== "/" && EXCLU.test(url.pathname)) return next();

    const ua = request.headers.get("user-agent") ?? "";
    if (!ua || !BOT_UA.test(ua)) return next();

    const cible = `${PRERENDER_SERVE}?__path=${encodeURIComponent(url.pathname)}`;
    const amont = await fetch(cible, {
      method: request.method,
      headers: { "user-agent": ua, accept: "text/html" },
      signal: AbortSignal.timeout(8000),
    });
    if (amont.status >= 500) return next();

    const entetes = new Headers();
    amont.headers.forEach((v, k) => {
      if (!NON_RECOPIES.has(k.toLowerCase())) entetes.set(k, v);
    });
    entetes.set("content-type", "text/html; charset=utf-8");

    return new Response(request.method === "HEAD" ? null : amont.body, {
      status: amont.status,
      headers: entetes,
    });
  } catch {
    return next();
  }
}
