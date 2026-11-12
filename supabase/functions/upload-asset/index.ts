// Atelier – envoi des fichiers du couple (photos d'inspiration, logo) dans le bucket privé maries-assets.
// Le navigateur n'écrit jamais dans le bucket : cette fonction vérifie tout puis écrit avec service_role.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { analyserSvg, detecterFormat, retirerMetadonnees } from "./fichier.ts";

const MAX_FICHIER = 10 * 1024 * 1024;
const MAX_TOTAL = 50 * 1024 * 1024;
const BUCKET = "maries-assets";

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const refus = (code: string, message: string, s = 400) => json({ error: code, message }, s);

// Fichiers TTF officiels (google/fonts, licence OFL) pour la conversion du monogramme en tracés.
const SOURCE_POLICES = "https://raw.githubusercontent.com/google/fonts/main/ofl/";
const POLICES_TTF: Record<string, string> = {
  "cinzel.ttf": "cinzel/Cinzel%5Bwght%5D.ttf", "marcellus.ttf": "marcellus/Marcellus-Regular.ttf",
  "forum.ttf": "forum/Forum-Regular.ttf", "italiana.ttf": "italiana/Italiana-Regular.ttf",
  "tenorsans.ttf": "tenorsans/TenorSans-Regular.ttf", "greatvibes.ttf": "greatvibes/GreatVibes-Regular.ttf",
  "parisienne.ttf": "parisienne/Parisienne-Regular.ttf", "pinyonscript.ttf": "pinyonscript/PinyonScript-Regular.ttf",
  "allura.ttf": "allura/Allura-Regular.ttf", "alexbrush.ttf": "alexbrush/AlexBrush-Regular.ttf",
  "tangerine.ttf": "tangerine/Tangerine-Regular.ttf", "italianno.ttf": "italianno/Italianno-Regular.ttf",
  "monsieurladoulaise.ttf": "monsieurladoulaise/MonsieurLaDoulaise-Regular.ttf",
  "sacramento.ttf": "sacramento/Sacramento-Regular.ttf", "dancingscript.ttf": "dancingscript/DancingScript%5Bwght%5D.ttf",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return refus("methode", "POST uniquement", 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: u } = token ? await db.auth.getUser(token) : { data: null };
  const userId = u?.user?.id;
  if (!userId) return refus("non_authentifie", "Connexion requise", 401);
  const { data: roles } = await db.from("user_roles").select("role").eq("user_id", userId);
  const r = (roles ?? []).map((x: { role: string }) => x.role);
  const estAdmin = r.includes("admin") || r.includes("super_admin");

  // Action admin : (ré)importer les polices TTF dans le bucket public « polices ».
  if ((req.headers.get("Content-Type") ?? "").includes("application/json")) {
    const corps = await req.json().catch(() => null);
    if (corps?.action !== "importer_polices") return refus("action_inconnue", "Action inconnue");
    if (!estAdmin) return refus("acces_refuse", "Réservé aux admins", 403);
    const bilan: Record<string, string> = {};
    for (const [fichier, chemin] of Object.entries(POLICES_TTF)) {
      const res = await fetch(SOURCE_POLICES + chemin);
      if (!res.ok) { bilan[fichier] = `téléchargement ${res.status}`; continue; }
      const octets = new Uint8Array(await res.arrayBuffer());
      const sig = Array.from(octets.slice(0, 4)).map((b) => b.toString(16).padStart(2, "0")).join("");
      if (sig !== "00010000" && sig !== "74727565") { bilan[fichier] = "pas un TTF"; continue; }
      const { error } = await db.storage.from("polices").upload(fichier, octets, { contentType: "font/ttf", upsert: true, cacheControl: "31536000" });
      bilan[fichier] = error ? `erreur ${error.message}` : `ok ${octets.length} octets`;
    }
    return json({ bilan });
  }

  if (!estAdmin && (!r.includes("client") || r.includes("prestataire"))) return refus("acces_refuse", "Réservé aux futurs mariés", 403);

  const form = await req.formData().catch(() => null);
  const fichier = form?.get("fichier");
  if (!(fichier instanceof File)) return refus("fichier_absent", "Aucun fichier reçu");
  const type = String(form!.get("type") ?? "inspiration");
  if (type !== "inspiration" && type !== "logo") return refus("type_invalide", "Type de fichier inconnu");
  if (fichier.size > MAX_FICHIER) return refus("trop_lourd", "Ce fichier dépasse 10 Mo.");

  let octets = new Uint8Array(await fichier.arrayBuffer());
  if (octets.length > MAX_FICHIER) return refus("trop_lourd", "Ce fichier dépasse 10 Mo.");
  const format = detecterFormat(octets);
  if (format === "image/heic") {
    return refus("heic", "Les photos HEIC de l'iPhone ne sont pas acceptées. Choisissez le format « Le plus compatible » dans les réglages de l'appareil photo, ou envoyez une capture d'écran de la photo.");
  }
  if (!format) return refus("format_refuse", "Format non accepté : envoyez une image JPG, PNG, WEBP ou SVG.");
  if (type === "logo" && format !== "image/svg+xml" && format !== "image/png") {
    return refus("format_refuse", "Le logo doit être un fichier SVG ou PNG transparent.");
  }

  if (format === "image/svg+xml") {
    const a = analyserSvg(new TextDecoder("utf-8", { fatal: false }).decode(octets));
    if (!a.ok) return refus("svg_refuse", a.motif);
    octets = new TextEncoder().encode(a.svg);
  } else {
    octets = retirerMetadonnees(octets, format);
  }

  // Espace total du couple (50 Mo)
  const { data: lignes } = await db.from("photos_inspiration").select("taille_octets").eq("user_id", userId);
  const utilise = (lignes ?? []).reduce((s: number, l: { taille_octets: number }) => s + Number(l.taille_octets), 0);
  if (utilise + octets.length > MAX_TOTAL) {
    return refus("espace_plein", "Votre espace de 50 Mo est plein. Supprimez un fichier pour en ajouter un nouveau.");
  }

  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg" }[format];
  const chemin = `${userId}/${type}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await db.storage.from(BUCKET).upload(chemin, octets, { contentType: format, upsert: false });
  if (upErr) { console.error("upload", upErr); return refus("erreur_stockage", "L'envoi a échoué, réessayez.", 500); }

  const entier = (k: string) => { const n = Number(form!.get(k)); return Number.isInteger(n) && n > 0 && n < 20000 ? n : null; };
  let couleurs: string[] = [];
  try {
    const c = JSON.parse(String(form!.get("couleurs") ?? "[]"));
    if (Array.isArray(c)) couleurs = c.filter((x) => typeof x === "string" && /^#[0-9A-Fa-f]{6}$/.test(x)).slice(0, 5).map((x) => x.toUpperCase());
  } catch { /* couleurs facultatives */ }
  const nom = String(fichier.name || "fichier").replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 120) || "fichier";

  const { data: ligne, error: insErr } = await db.from("photos_inspiration").insert({
    user_id: userId, type, fichier_nom: nom, storage_path: chemin, taille_octets: octets.length, format,
    largeur: entier("largeur"), hauteur: entier("hauteur"), couleurs_dominantes: couleurs,
  }).select("*").single();
  if (insErr) {
    await db.storage.from(BUCKET).remove([chemin]);
    console.error("insert", insErr);
    return refus("erreur_interne", "L'envoi a échoué, réessayez.", 500);
  }
  return json({ fichier: ligne, espace_utilise: utilise + octets.length, espace_max: MAX_TOTAL });
});
