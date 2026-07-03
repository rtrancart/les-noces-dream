// generate-charte-pdf-preuve — Génération à la demande du PDF de preuve.
//
// Modèle : le PDF n'est PAS stocké. La preuve juridique réelle réside dans les
// lignes immuables signatures_charte + chartes_versions (reliées par charte_hash).
// Cette fonction matérialise à la volée un document lisible, auto-suffisant :
//   - identité du signataire, horodatage, IP, user-agent, méthode d'auth
//   - bloc d'intégrité : hash SHA-256, numéro de version, titre
//   - TEXTE INTÉGRAL de la charte, extrait de la VERSION FIGÉE liée à la
//     signature (chartes_versions.contenu_html via charte_version_id), jamais
//     de la version courante. Une nouvelle version publiée depuis n'affecte
//     donc pas le PDF d'une ancienne signature.
//
// Sécurité : réservée aux admins / super_admins (vérification côté serveur).
// Réponse : application/pdf en flux direct. Aucun bucket, aucune signed URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "content-disposition",
};

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Strip HTML tags into plain text for jsPDF rendering (jsPDF n'interprète pas HTML).
// Conserve la structure des paragraphes/titres via des sauts de ligne.
function htmlToPlainText(html: string): string {
  return html
    .replace(/<\s*(br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n\n")
    .replace(/<\s*li[^>]*>/gi, "  • ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&eacute;/g, "é").replace(/&egrave;/g, "è").replace(/&ecirc;/g, "ê")
    .replace(/&agrave;/g, "à").replace(/&acirc;/g, "â").replace(/&ccedil;/g, "ç")
    .replace(/&ocirc;/g, "ô").replace(/&ucirc;/g, "û").replace(/&ugrave;/g, "ù")
    .replace(/&icirc;/g, "î").replace(/&iuml;/g, "ï")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Admin only
    const { data: roles } = await adminClient
      .from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { signature_id } = await req.json();
    if (!signature_id) throw new Error("signature_id requis");

    // On récupère la signature ET la version FIGÉE liée (par charte_version_id, immuable).
    // Jamais la version courante — chaque signature reste rattachée à son contenu d'origine.
    const { data: sig, error: sigErr } = await adminClient
      .from("signatures_charte")
      .select("*, prestataires!inner(nom_commercial, email_contact), profiles!inner(prenom, nom, email), chartes_versions!inner(titre, numero_version, contenu_html, contenu_hash, entree_en_vigueur_le)")
      .eq("id", signature_id).maybeSingle();
    if (sigErr) throw sigErr;
    if (!sig) throw new Error("Signature introuvable");

    const versionFigee = sig.chartes_versions;
    const contenuHtml: string = versionFigee?.contenu_html ?? "";

    // Vérification d'intégrité : le hash de la version figée doit correspondre au
    // hash gelé dans la signature. Si divergence, on refuse d'émettre le PDF plutôt
    // que de présenter un texte qui ne serait pas exactement celui signé.
    const hashRecalcule = await sha256Hex(contenuHtml);
    const hashSignature: string = sig.charte_hash;
    const hashVersion: string = versionFigee?.contenu_hash;
    if (hashRecalcule !== hashSignature || hashSignature !== hashVersion) {
      return new Response(JSON.stringify({
        error: "integrity_mismatch",
        detail: "Le hash recalculé du contenu de la version ne correspond pas au hash figé dans la signature. PDF non émis.",
        hash_signature: hashSignature,
        hash_version: hashVersion,
        hash_recalcule: hashRecalcule,
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Rendu PDF
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const ensureRoom = (needed: number) => {
      if (y + needed > pageHeight - margin) { doc.addPage(); y = margin; }
    };

    doc.setFont("helvetica", "bold"); doc.setFontSize(18);
    doc.text("Preuve de signature électronique", margin, y); y += 8;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(120);
    doc.text("LesNoces.net — Charte Qualité Prestataires", margin, y); y += 10;

    doc.setDrawColor(165, 125, 39); doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y); y += 8;

    const rows: [string, string][] = [
      ["Signataire", `${sig.profiles?.prenom ?? ""} ${sig.profiles?.nom ?? ""}`.trim() || "—"],
      ["Email", sig.profiles?.email ?? "—"],
      ["Fiche prestataire", sig.prestataires?.nom_commercial ?? "—"],
      ["Version de la Charte", sig.charte_numero_version],
      ["Titre", versionFigee?.titre ?? "—"],
      ["Entrée en vigueur", versionFigee?.entree_en_vigueur_le ? new Date(versionFigee.entree_en_vigueur_le).toLocaleDateString("fr-FR") : "—"],
      ["Date de signature", new Date(sig.signe_le).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })],
      ["Méthode d'authentification", sig.methode_auth],
      ["Adresse IP", sig.ip_signataire ?? "non capturée"],
      ["Navigateur (UA)", (sig.user_agent ?? "").slice(0, 120)],
      ["Hash SHA-256 du contenu signé", sig.charte_hash],
      ["Identifiant de signature", sig.id],
    ];

    doc.setFontSize(10); doc.setTextColor(40);
    for (const [label, value] of rows) {
      const lines = doc.splitTextToSize(value, contentWidth - 55);
      ensureRoom(Math.max(6, lines.length * 5));
      doc.setFont("helvetica", "bold");
      doc.text(label, margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(lines, margin + 55, y);
      y += Math.max(6, lines.length * 5);
    }

    // Bloc intégrité : rappel explicite
    y += 4;
    doc.setDrawColor(200); doc.line(margin, y, pageWidth - margin, y); y += 6;
    doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(90);
    const integrity = doc.splitTextToSize(
      "Vérification d'intégrité effectuée à l'émission de ce document : le hash SHA-256 du texte intégral " +
      "de la Charte reproduit ci-après est identique au hash figé dans la ligne de signature et à celui " +
      "figé dans la version publiée. Le texte présenté est donc exactement celui qui a été signé.",
      contentWidth
    );
    ensureRoom(integrity.length * 4 + 4);
    doc.text(integrity, margin, y); y += integrity.length * 4 + 6;

    // Texte intégral de la Charte figée
    doc.addPage(); y = margin;
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(30);
    doc.text(`Charte Qualité — v${sig.charte_numero_version}`, margin, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`Titre : ${versionFigee?.titre ?? "—"}`, margin, y); y += 4;
    doc.text(`Hash : ${sig.charte_hash}`, margin, y); y += 8;

    doc.setDrawColor(165, 125, 39);
    doc.line(margin, y, pageWidth - margin, y); y += 6;

    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(30);
    const plain = htmlToPlainText(contenuHtml);
    const paragraphs = plain.split(/\n\n+/);
    for (const para of paragraphs) {
      const lines = doc.splitTextToSize(para, contentWidth);
      for (const line of lines) {
        ensureRoom(5);
        doc.text(line, margin, y);
        y += 5;
      }
      y += 3;
    }

    // Mention légale finale
    ensureRoom(20);
    y += 4;
    doc.setDrawColor(200); doc.line(margin, y, pageWidth - margin, y); y += 6;
    doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(110);
    const legal = doc.splitTextToSize(
      "Document généré à la demande. Preuve électronique conforme à l'article 1366 du Code civil " +
      "et au règlement eIDAS. L'original juridique demeure constitué par les enregistrements immuables " +
      "en base de données (signatures_charte + chartes_versions) reliés par l'empreinte SHA-256.",
      contentWidth
    );
    doc.text(legal, margin, y);

    const pdfBytes = new Uint8Array(doc.output("arraybuffer"));
    const filename = `preuve-signature-${sig.prestataires?.nom_commercial?.replace(/[^a-z0-9]+/gi, "-").toLowerCase() ?? sig.prestataire_id}-v${sig.charte_numero_version}.pdf`;

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
