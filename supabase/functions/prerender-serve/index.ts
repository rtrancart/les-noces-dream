// Sert les snapshots pré-rendus aux robots, l'application interactive aux humains.
//
// Cette fonction est appelée par une règle de réécriture conditionnelle de
// l'hébergeur (voir vercel.json) : toute la logique vit ici, l'hébergeur ne
// porte qu'un proxy. Aucune erreur serveur n'est jamais renvoyée à un robot :
// le repli est toujours l'application normale.
//
// En-tête de traçabilité `x-prerender` :
//   snapshot     — snapshot servi depuis le bucket
//   passthrough  — application servie (humain, snapshot absent, doute, erreur)
//   notfound     — page inconnue du recensement : vraie absence (404)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { estRobot, cheminStockageDepuisUrl } from "../_shared/bots.ts";

const SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") ?? "https://lesnoces.net").replace(/\/$/, "");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const BUCKET = "prerender-snapshots";

/** Chemins jamais concernés par le pré-rendu (double sécurité côté fonction). */
const PREFIXES_EXCLUS = [
  "/admin",
  "/espace-pro",
  "/espace-client",
  "/connexion",
  "/inscription",
  "/recherche",
  "/assets",
  "/api",
  "/auth",
  "/paiement",
  "/checkout",
];

function estExclu(p: string): boolean {
  if (/\.[a-z0-9]{2,5}$/i.test(p)) return true; // fichiers d'actifs
  return PREFIXES_EXCLUS.some((prefix) => p === prefix || p.startsWith(prefix + "/"));
}

/** Renvoie la coquille de l'application. `/index.html` n'est jamais réécrit. */
async function servirApplication(marqueur: string, statut = 200): Promise<Response> {
  try {
    const res = await fetch(`${SITE_URL}/index.html`, {
      headers: { "user-agent": "prerender-serve/1.0 passthrough" },
    });
    const html = await res.text();
    return new Response(html, {
      status: res.ok ? statut : 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-prerender": marqueur,
      },
    });
  } catch {
    // Dernier recours : redirection vers la racine plutôt qu'une erreur serveur.
    return new Response(null, {
      status: 302,
      headers: { location: `${SITE_URL}/`, "x-prerender": `${marqueur}-fallback` },
    });
  }
}

/** Extrait le chemin d'origine derrière le proxy `/functions/v1/prerender-serve/...`. */
function cheminDemande(req: Request): string {
  const url = new URL(req.url);
  const explicite = url.searchParams.get("__path");
  let p = explicite ?? url.pathname.replace(/^\/functions\/v1\/prerender-serve/, "");
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/{2,}/g, "/");
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p || "/";
}

Deno.serve(async (req) => {
  const chemin = cheminDemande(req);

  // Humain, chemin exclu, ou méthode non-GET → application inchangée.
  if (req.method !== "GET" && req.method !== "HEAD") {
    return servirApplication("passthrough-method");
  }
  if (estExclu(chemin)) return servirApplication("passthrough-exclu");
  if (!estRobot(req.headers.get("user-agent"))) return servirApplication("passthrough-humain");

  try {
    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Lecture autoritaire, unique et indexée sur url_path.
    const { data, error } = await supabase
      .from("prerender_queue")
      .select("url_path, storage_path")
      .eq("url_path", chemin)
      .maybeSingle();

    // Erreur de lecture → surtout pas de fausse absence.
    if (error) return servirApplication("passthrough-erreur-lecture");

    // Page inconnue du recensement → vraie absence.
    if (!data) {
      return new Response(
        `<!doctype html><html lang="fr"><head><meta charset="utf-8">` +
          `<meta name="robots" content="noindex"><title>Page introuvable — Les Noces</title></head>` +
          `<body><h1>Page introuvable</h1>` +
          `<p><a href="${SITE_URL}/">Retour à l'accueil</a></p></body></html>`,
        {
          status: 404,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "x-prerender": "notfound",
          },
        },
      );
    }

    // Page indexable connue mais snapshot pas encore produit → application.
    const storagePath = data.storage_path ?? cheminStockageDepuisUrl(chemin);
    if (!data.storage_path) return servirApplication("passthrough-snapshot-absent");

    const objectUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
    const snap = await fetch(objectUrl);
    if (!snap.ok) return servirApplication("passthrough-snapshot-illisible");

    const html = await snap.text();
    if (!html || html.length < 200) return servirApplication("passthrough-snapshot-vide");

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=600",
        "x-prerender": "snapshot",
        "x-prerender-path": storagePath,
      },
    });
  } catch {
    return servirApplication("passthrough-erreur");
  }
});
