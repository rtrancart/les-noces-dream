// kpi-export-sheets — écrit une ligne d'indicateurs agrégés par jour (heure de
// Paris) dans l'onglet "kpi_quotidiens" d'une feuille Google, via un compte de
// service. Idempotent : une date déjà présente en colonne A est remplacée.
// Indicateur indisponible => cellule vide, jamais 0. Aucune donnée personnelle.
//
// Appels :
//  - cron (service_role) : {} => la veille, photos du jour incluses.
//  - admin : { rattrapage: true } => du 01/10/2026 à la veille ; photos du
//    jour seulement sur la veille.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ONGLET = "kpi_quotidiens";
const DEBUT_RATTRAPAGE = "2026-10-01";
const SOURCES = ["google_ads", "chatgpt_ads", "chatgpt_organique", "meta_ads", "meta_organique", "pinterest_ads",
  "pinterest_organique", "email", "seo", "direct", "autre"];
export const COLONNES = [
  "demandes_devis_valides", "demandes_devis_rejetees", "affichages_telephone", "visites_fiches",
  "fiches_vues_distinctes", "comptes_couples_crees", "favoris_ajoutes", "consentements_marketing_couples",
  ...SOURCES.map((s) => `demandes_valides_${s}`), ...SOURCES.map((s) => `affichages_telephone_${s}`),
  "fiches_actives", "fiches_correctes", "fiches_completes", "fiches_avec_prix", "fiches_avec_6_photos",
  "fiches_avec_avis", "comptes_prestataires_actives", "prestataires_connectes_7j", "chartes_signees",
  "prestataires_en_essai", "abonnes_payants_standard", "abonnes_payants_premium", "suspendus",
  "score_classement_moyen", "snapshots_a_jour", "snapshots_a_traiter", "snapshots_abandonne",
  "pages_indexables", "articles_publies", "atelier_couples_actifs_7j", "atelier_cout_ia_jour",
];

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

const b64url = (buf: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof buf === "string" ? new TextEncoder().encode(buf) : new Uint8Array(buf as ArrayBuffer);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function jetonGoogle(sa: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const entete = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const charge = b64url(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const cle = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cle, new TextEncoder().encode(`${entete}.${charge}`));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${entete}.${charge}.${b64url(sig)}`,
    }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Jeton Google [${res.status}] : ${txt.slice(0, 300)}`);
  return JSON.parse(txt).access_token as string;
}

const dateParis = (decalageJours: number) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const d = new Date(`${p}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + decalageJours);
  return d.toISOString().slice(0, 10);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  let estService = token === serviceRoleKey || parseJwtClaims(token)?.role === "service_role";
  if (!estService) {
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ ok: false, message: "Non autorisé" }, 401);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id);
    if (!roles?.some((r) => r.role === "admin" || r.role === "super_admin")) return json({ ok: false, message: "Accès refusé" }, 403);
    estService = false;
  }

  let body: { rattrapage?: boolean; apercu?: boolean } = {};
  try { body = await req.json(); } catch { /* vide */ }

  try {
    const hier = dateParis(-1);
    const dates: string[] = [];
    if (body.rattrapage) {
      for (let d = new Date(`${DEBUT_RATTRAPAGE}T12:00:00Z`); d.toISOString().slice(0, 10) <= hier; d.setUTCDate(d.getUTCDate() + 1)) {
        dates.push(d.toISOString().slice(0, 10));
      }
    } else dates.push(hier);

    const lignes: Record<string, (string | number)[]> = {};
    for (const d of dates) {
      const { data, error } = await admin.rpc("get_kpi_quotidiens", { p_date: d, p_inclure_photo: d === hier });
      if (error) throw new Error(`get_kpi_quotidiens(${d}) : ${error.message}`);
      const k = (data ?? {}) as Record<string, number | null>;
      lignes[d] = [d, ...COLONNES.map((c) => (k[c] === null || k[c] === undefined ? "" : Number(k[c])))];
    }

    // Aperçu (sans écriture) : vérifie le calcul sans toucher à la feuille.
    if (body.apercu) return json({ ok: true, apercu: true, jours: dates.length, colonnes: ["date", ...COLONNES], hier: lignes[hier] });

    const saBrut = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    const feuille = Deno.env.get("KPI_SHEET_ID");
    if (!saBrut || !feuille) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON ou KPI_SHEET_ID manquant");
    const jeton = await jetonGoogle(JSON.parse(saBrut));
    const G = `https://sheets.googleapis.com/v4/spreadsheets/${feuille}`;
    const g = async (url: string, init?: RequestInit) => {
      const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" } });
      const t = await r.text();
      if (!r.ok) throw new Error(`Google Sheets [${r.status}] : ${t.slice(0, 400)}`);
      return t ? JSON.parse(t) : {};
    };

    const meta = await g(`${G}?fields=sheets.properties.title`);
    if (!meta.sheets?.some((s: { properties: { title: string } }) => s.properties.title === ONGLET)) {
      await g(`${G}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: [{ addSheet: { properties: { title: ONGLET } } }] }) });
    }

    const colA = await g(`${G}/values/${ONGLET}!A:A`);
    const existantes: string[] = (colA.values ?? []).map((r: string[]) => r[0] ?? "");
    const L = colonneLettre(COLONNES.length + 1);
    const maj: { range: string; values: (string | number)[][] }[] = [
      { range: `${ONGLET}!A1:${L}1`, values: [["date", ...COLONNES]] },
    ];
    const nouvelles: (string | number)[][] = [];
    for (const d of dates) {
      const idx = existantes.indexOf(d);
      if (idx > 0) maj.push({ range: `${ONGLET}!A${idx + 1}:${colonneLettre(COLONNES.length + 1)}${idx + 1}`, values: [lignes[d]] });
      else nouvelles.push(lignes[d]);
    }
    await g(`${G}/values:batchUpdate`, { method: "POST", body: JSON.stringify({ valueInputOption: "RAW", data: maj }) });
    if (nouvelles.length) {
      const depart = Math.max(existantes.length, 1) + 1;
      await g(`${G}/values:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({ valueInputOption: "RAW", data: [{
          range: `${ONGLET}!A${depart}:${colonneLettre(COLONNES.length + 1)}${depart + nouvelles.length - 1}`,
          values: nouvelles,
        }] }),
      });
    }

    const resultat = { ok: true, jours: dates.length, remplacees: dates.length - nouvelles.length, ajoutees: nouvelles.length, hier: lignes[hier] };
    console.log("[kpi-export-sheets]", JSON.stringify({ ...resultat, hier: undefined, par: estService ? "service" : "admin" }));
    return json(resultat);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[kpi-export-sheets] échec", message);
    return json({ ok: false, message }, 500);
  }
});

function colonneLettre(n: number) {
  let s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
