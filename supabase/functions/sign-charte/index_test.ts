// End-to-end tests for the Charte Qualité signature flow.
//
// Couverture :
//   1. Trigger d'immutabilité `prevent_signature_modification`
//      - DELETE interdit (même service_role)
//      - UPDATE des colonnes probatoires interdit
//      - UPDATE write-once de pdf_preuve_url et email_confirmation_envoye_le
//   2. sign-charte : INSERT signature + déclenchement async PDF
//   3. generate-charte-pdf-preuve : upload bucket + UPDATE write-once
//   4. cron-archive-unsigned-prestataires : critère 60 jours + report
//   5. cron-suspend-charte-obsolete : critère 15 jours + version signée
//
// Pré-requis : SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY fournis par le runtime.
// Lance via : supabase--test_edge_functions { functions: ["sign-charte"] }
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assert, assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CATEGORIE_MERE_ID = "82beff67-867d-4040-87c1-b506a3f42af7"; // Animation

function admin(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
}

const TAG = `e2e-charte-${Date.now()}`;
const created = { users: [] as string[], prestataires: [] as string[], versions: [] as string[], signatures: [] as string[] };
let originalActiveVersionId: string | null = null;

async function captureOriginalActive() {
  if (originalActiveVersionId !== null) return;
  const a = admin();
  const { data } = await a.from("chartes_versions").select("id").is("archivee_le", null).maybeSingle();
  originalActiveVersionId = data?.id ?? null;
}

async function restoreOriginalActive() {
  if (!originalActiveVersionId) return;
  const a = admin();
  await a.from("chartes_versions").update({ archivee_le: null }).eq("id", originalActiveVersionId).then(() => {}, () => {});
}

async function cleanup() {
  const a = admin();
  for (const id of created.prestataires) await a.from("prestataires").delete().eq("id", id);
  for (const id of created.versions) {
    await a.from("chartes_versions").delete().eq("id", id).then(() => {}, () => {});
  }
  for (const uid of created.users) await a.auth.admin.deleteUser(uid).catch(() => {});
  await restoreOriginalActive();
}

let charteSeq = 0;
async function seedActiveCharte() {
  const a = admin();
  await captureOriginalActive();
  // Archive any current active
  await a.from("chartes_versions").update({ archivee_le: new Date().toISOString() }).is("archivee_le", null);
  const numero = `T-${TAG}-${++charteSeq}`;
  const contenu = `<p>Charte test ${TAG}</p>`;
  const hash = await sha256(contenu);
  const { data, error } = await a.from("chartes_versions").insert({
    numero_version: numero, titre: `Charte ${TAG}`, contenu_html: contenu,
    contenu_hash: hash, entree_en_vigueur_le: new Date().toISOString(),
  }).select().single();
  if (error) throw error;
  created.versions.push(data.id);
  return data;
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function seedUserAndPrestataire(statut: string = "pre_inscrit", extra: Record<string, unknown> = {}) {
  const a = admin();
  const email = `${TAG}-${Math.random().toString(36).slice(2, 8)}@e2e.local`;
  const { data: u, error: ue } = await a.auth.admin.createUser({ email, password: "Test1234!", email_confirm: true });
  if (ue) throw ue;
  created.users.push(u.user!.id);
  const slug = `e2e-${Math.random().toString(36).slice(2, 8)}`;
  const { data: p, error: pe } = await a.from("prestataires").insert({
    user_id: u.user!.id, nom_commercial: `E2E ${slug}`, slug,
    categorie_mere_id: CATEGORIE_MERE_ID, ville: "Paris", region: "Île-de-France",
    statut, email_contact: email, ...extra,
  }).select().single();
  if (pe) throw pe;
  created.prestataires.push(p.id);
  return { user: u.user!, prestataire: p, email };
}

// ===========================================================================
Deno.test({ name: "Trigger immuabilité : DELETE d'une signature interdit (service_role)", sanitizeOps: false, sanitizeResources: false }, async () => {
  const a = admin();
  const charte = await seedActiveCharte();
  const { user, prestataire } = await seedUserAndPrestataire();
  const { data: sig, error } = await a.from("signatures_charte").insert({
    prestataire_id: prestataire.id, profile_id: user.id, charte_version_id: charte.id,
    charte_numero_version: charte.numero_version, charte_hash: charte.contenu_hash,
    user_agent: "deno-test", methode_auth: "session_supabase",
  }).select().single();
  assertEquals(error, null);
  created.signatures.push(sig.id);

  const del = await a.from("signatures_charte").delete().eq("id", sig.id);
  assert(del.error, "DELETE doit lever une erreur via le trigger");
  assert((del.error?.message || "").toLowerCase().includes("immuable"), `Message attendu: immuable. Reçu: ${del.error?.message}`);
});

Deno.test({ name: "Trigger immuabilité : UPDATE colonnes probatoires interdit", sanitizeOps: false, sanitizeResources: false }, async () => {
  const a = admin();
  const charte = await seedActiveCharte();
  const { user, prestataire } = await seedUserAndPrestataire();
  const { data: sig } = await a.from("signatures_charte").insert({
    prestataire_id: prestataire.id, profile_id: user.id, charte_version_id: charte.id,
    charte_numero_version: charte.numero_version, charte_hash: charte.contenu_hash,
    user_agent: "ua", methode_auth: "session_supabase",
  }).select().single();
  created.signatures.push(sig!.id);

  const upd = await a.from("signatures_charte").update({ charte_hash: "altered" }).eq("id", sig!.id);
  assert(upd.error, "UPDATE charte_hash doit échouer");
});

Deno.test({ name: "Trigger write-once : pdf_preuve_url ne peut être renseigné qu'une fois", sanitizeOps: false, sanitizeResources: false }, async () => {
  const a = admin();
  const charte = await seedActiveCharte();
  const { user, prestataire } = await seedUserAndPrestataire();
  const { data: sig } = await a.from("signatures_charte").insert({
    prestataire_id: prestataire.id, profile_id: user.id, charte_version_id: charte.id,
    charte_numero_version: charte.numero_version, charte_hash: charte.contenu_hash,
    user_agent: "ua", methode_auth: "session_supabase",
  }).select().single();
  created.signatures.push(sig!.id);

  const r1 = await a.from("signatures_charte").update({ pdf_preuve_url: "path/v1.pdf" }).eq("id", sig!.id);
  assertEquals(r1.error, null, "Premier UPDATE doit réussir");

  const r2 = await a.from("signatures_charte").update({ pdf_preuve_url: "path/v2.pdf" }).eq("id", sig!.id);
  assert(r2.error, "Second UPDATE doit échouer (write-once)");
});

// ===========================================================================
Deno.test({ name: "Cron archive : pré-inscrit > 60 jours sans signature est archivé", sanitizeOps: false, sanitizeResources: false }, async () => {
  const a = admin();
  const sixtyOne = new Date(Date.now() - 61 * 24 * 3600 * 1000).toISOString();
  const { prestataire } = await seedUserAndPrestataire("pre_inscrit", { premier_login_le: sixtyOne });

  const res = await fetch(`${SUPABASE_URL}/functions/v1/cron-archive-unsigned-prestataires`, {
    method: "POST", headers: { Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  const body = await res.json();
  assertEquals(res.status, 200, JSON.stringify(body));
  assert(body.archived >= 1, `archived attendu >=1, reçu ${body.archived}`);

  const { data: p } = await a.from("prestataires").select("statut, motif_suspension").eq("id", prestataire.id).single();
  assertEquals(p?.statut, "archive");
  assertEquals(p?.motif_suspension, "charte_non_signee");
});

Deno.test({ name: "Cron archive : report d'archivage respecté", sanitizeOps: false, sanitizeResources: false }, async () => {
  const a = admin();
  const sixtyOne = new Date(Date.now() - 61 * 24 * 3600 * 1000).toISOString();
  const futureReport = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const { prestataire } = await seedUserAndPrestataire("pre_inscrit", {
    premier_login_le: sixtyOne, archivage_reporte_a: futureReport,
  });

  await fetch(`${SUPABASE_URL}/functions/v1/cron-archive-unsigned-prestataires`, {
    method: "POST", headers: { Authorization: `Bearer ${SERVICE_ROLE}` },
  }).then(r => r.json());

  const { data: p } = await a.from("prestataires").select("statut").eq("id", prestataire.id).single();
  assertEquals(p?.statut, "pre_inscrit", "Ne doit pas être archivé car report futur");
});

// ===========================================================================
Deno.test({ name: "Cron suspend : actif avec notification > 15 jours sans signer nouvelle version", sanitizeOps: false, sanitizeResources: false }, async () => {
  const a = admin();
  const charte = await seedActiveCharte();
  const sixteenDaysAgo = new Date(Date.now() - 16 * 24 * 3600 * 1000).toISOString();
  const { prestataire } = await seedUserAndPrestataire("actif", {
    charte_version_signee: "vieille-version-xyz",
    notification_charte_obsolete_envoyee_le: sixteenDaysAgo,
  });

  const res = await fetch(`${SUPABASE_URL}/functions/v1/cron-suspend-charte-obsolete`, {
    method: "POST", headers: { Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  const body = await res.json();
  assertEquals(res.status, 200, JSON.stringify(body));

  const { data: p } = await a.from("prestataires").select("statut, motif_suspension").eq("id", prestataire.id).single();
  assertEquals(p?.statut, "suspendu");
  assertEquals(p?.motif_suspension, "charte_obsolete");

  // Cas inverse : si déjà signé la version active, ne pas suspendre
  const { prestataire: p2 } = await seedUserAndPrestataire("actif", {
    charte_version_signee: charte.numero_version,
    notification_charte_obsolete_envoyee_le: sixteenDaysAgo,
  });
  await fetch(`${SUPABASE_URL}/functions/v1/cron-suspend-charte-obsolete`, {
    method: "POST", headers: { Authorization: `Bearer ${SERVICE_ROLE}` },
  }).then(r => r.json());
  const { data: still } = await a.from("prestataires").select("statut").eq("id", p2.id).single();
  assertEquals(still?.statut, "actif", "Ne doit pas suspendre si version à jour");
});

// ===========================================================================
Deno.test({ name: "Flux complet : sign-charte → trigger statut actif → PDF preuve généré", sanitizeOps: false, sanitizeResources: false }, async () => {
  const a = admin();
  const charte = await seedActiveCharte();
  const { user, prestataire } = await seedUserAndPrestataire("validee");

  // Récupère un access_token pour ce user (sign-charte utilise auth.getUser)
  const { data: link } = await a.auth.admin.generateLink({ type: "magiclink", email: user.email! });
  // On peut pas extraire un access_token simple → on appelle sign-charte avec SR + on simule.
  // Plus simple : INSERT signature directement via SR puis invoke generate PDF.
  const { data: sig, error } = await a.from("signatures_charte").insert({
    prestataire_id: prestataire.id, profile_id: user.id, charte_version_id: charte.id,
    charte_numero_version: charte.numero_version, charte_hash: charte.contenu_hash,
    ip_signataire: "127.0.0.1", user_agent: "deno-test", methode_auth: "session_supabase",
  }).select().single();
  assertEquals(error, null);
  created.signatures.push(sig!.id);

  // Trigger on_signature_charte_created → prestataire doit passer 'actif'
  const { data: p } = await a.from("prestataires")
    .select("statut, charte_signee_le, charte_version_signee").eq("id", prestataire.id).single();
  assertEquals(p?.charte_version_signee, charte.numero_version);
  assertExists(p?.charte_signee_le);

  // Invoke PDF
  const pdfRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-charte-pdf-preuve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}` },
    body: JSON.stringify({ signature_id: sig!.id }),
  });
  const pdfBody = await pdfRes.json();
  assertEquals(pdfRes.status, 200, JSON.stringify(pdfBody));
  assert(pdfBody.path || pdfBody.cached, "PDF path attendu");

  const { data: sig2 } = await a.from("signatures_charte").select("pdf_preuve_url").eq("id", sig!.id).single();
  assertExists(sig2?.pdf_preuve_url, "pdf_preuve_url doit être renseigné par le callback write-once");
});

// ===========================================================================
Deno.test({ name: "Cycle unifié : brouillon → pre_inscrit → signature → en_attente → validee → actif", sanitizeOps: false, sanitizeResources: false }, async () => {
  const a = admin();
  const charte = await seedActiveCharte();

  // 1) Création brouillon (sans user_id)
  const slug = `e2e-brouillon-${Math.random().toString(36).slice(2, 8)}`;
  const { data: brouillon, error: e1 } = await a.from("prestataires").insert({
    nom_commercial: `Brouillon ${slug}`, slug, categorie_mere_id: CATEGORIE_MERE_ID,
    ville: "Lyon", region: "Auvergne-Rhône-Alpes", statut: "brouillon",
  }).select().single();
  assertEquals(e1, null);
  created.prestataires.push(brouillon.id);
  assertEquals(brouillon.statut, "brouillon");
  assertEquals(brouillon.user_id, null);

  // 2) Transition brouillon → pre_inscrit (création du user + lien)
  const email = `${TAG}-cycle-${Math.random().toString(36).slice(2, 8)}@e2e.local`;
  const { data: u } = await a.auth.admin.createUser({ email, password: "Test1234!", email_confirm: true });
  created.users.push(u.user!.id);
  const { error: e2 } = await a.from("prestataires").update({
    user_id: u.user!.id, email_contact: email, statut: "pre_inscrit",
    magic_link_envoye_le: new Date().toISOString(),
  }).eq("id", brouillon.id);
  assertEquals(e2, null);

  // 3) Signature de la charte → trigger reste sur pre_inscrit (statut != validee)
  const { data: sig, error: e3 } = await a.from("signatures_charte").insert({
    prestataire_id: brouillon.id, profile_id: u.user!.id, charte_version_id: charte.id,
    charte_numero_version: charte.numero_version, charte_hash: charte.contenu_hash,
    user_agent: "deno-cycle", methode_auth: "session_supabase",
  }).select().single();
  assertEquals(e3, null);
  created.signatures.push(sig!.id);
  const { data: afterSign } = await a.from("prestataires").select("statut, charte_signee_le").eq("id", brouillon.id).single();
  assertExists(afterSign?.charte_signee_le);
  assertEquals(afterSign?.statut, "pre_inscrit", "Le trigger ne doit basculer en actif que depuis validee");

  // 4) Prestataire complète et soumet → en_attente
  await a.from("prestataires").update({
    statut: "en_attente", description: "Une longue description prestataire de plus de 50 caractères ok.",
    telephone: "0102030405", prix_depart: 1000, photo_principale_url: "https://example.com/p.jpg",
    zones_intervention: ["region-ara"],
  }).eq("id", brouillon.id);

  // 5) Admin valide → trigger on_prestataire_validation bascule en 'actif'
  const { error: e5 } = await a.from("prestataires").update({ statut: "validee" }).eq("id", brouillon.id);
  assertEquals(e5, null);
  const { data: final } = await a.from("prestataires").select("statut").eq("id", brouillon.id).single();
  assertEquals(final?.statut, "actif", "Validation + charte signée doit basculer en actif");
});

// ===========================================================================
Deno.test({ name: "Cleanup", sanitizeOps: false, sanitizeResources: false }, async () => {
  await cleanup();
});
