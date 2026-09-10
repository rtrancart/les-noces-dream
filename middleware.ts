import { next, rewrite } from "@vercel/edge";

/**
 * Edge Middleware — uniquement pour la racine "/".
 *
 * Vercel sert le fichier statique dist/index.html pour "/" AVANT d'évaluer les
 * rewrites de vercel.json. La règle prerender-serve dédiée à la racine n'est
 * donc jamais atteinte, et les robots reçoivent la coquille SPA vide.
 *
 * Ce middleware s'exécute avant le service des fichiers statiques et reproduit
 * exactement la dualité déjà en place sur les autres routes :
 *   - robot   -> snapshot pré-rendu via prerender-serve
 *   - humain  -> comportement inchangé (index.html / SPA)
 *
 * En cas de doute ou d'erreur, on sert toujours la SPA (fail-open humain).
 *
 * Réversible : supprimer ce fichier et redéployer.
 */

// Même liste de user-agents que la condition `has` des rewrites prerender-serve
// dans vercel.json (source unique de vérité fonctionnelle).
const BOT_UA =
  /(bot|crawler|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|pinterest|whatsapp|telegram|discord|twitter|linkedinbot|applebot|headless|lighthouse|chrome-lighthouse|google-inspectiontool)/i;

const PRERENDER_SERVE =
  "https://egbohbwiywgyyculswvf.supabase.co/functions/v1/prerender-serve?__path=/";

export const config = {
  matcher: "/",
};

export default function middleware(request: Request) {
  try {
    const url = new URL(request.url);

    // Le pré-rendu ne concerne que la racine nue.
    if (url.pathname !== "/") return next();

    // Même échappatoire que la condition `missing` des rewrites existants.
    if (url.searchParams.has("__prerender_bypass")) return next();

    const ua = request.headers.get("user-agent") ?? "";
    if (!ua || !BOT_UA.test(ua)) return next();

    return rewrite(PRERENDER_SERVE);
  } catch {
    // Fail-open : jamais de page blanche pour un visiteur humain.
    return next();
  }
}
