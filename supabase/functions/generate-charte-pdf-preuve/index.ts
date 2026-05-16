// generate-charte-pdf-preuve — Generates immutable proof PDF for a signature
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { signature_id } = await req.json();
    if (!signature_id) throw new Error("signature_id requis");

    const { data: sig, error: sigErr } = await adminClient
      .from("signatures_charte")
      .select("*, prestataires!inner(nom_commercial, email_contact), profiles!inner(prenom, nom, email), chartes_versions!inner(titre, numero_version, contenu_hash, entree_en_vigueur_le)")
      .eq("id", signature_id).maybeSingle();
    if (sigErr) throw sigErr;
    if (!sig) throw new Error("Signature introuvable");

    if (sig.pdf_preuve_url) {
      return new Response(JSON.stringify({ success: true, pdf_url: sig.pdf_preuve_url, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 20;
    let y = margin;

    doc.setFont("helvetica", "bold"); doc.setFontSize(18);
    doc.text("Preuve de signature électronique", margin, y); y += 8;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(120);
    doc.text("LesNoces.net — Charte Qualité Prestataires", margin, y); y += 12;

    doc.setDrawColor(165, 125, 39); doc.setLineWidth(0.5);
    doc.line(margin, y, 210 - margin, y); y += 10;

    const rows: [string, string][] = [
      ["Signataire", `${sig.profiles?.prenom ?? ""} ${sig.profiles?.nom ?? ""}`.trim() || "—"],
      ["Email", sig.profiles?.email ?? "—"],
      ["Fiche prestataire", sig.prestataires?.nom_commercial ?? "—"],
      ["Version de la Charte", sig.charte_numero_version],
      ["Titre", sig.chartes_versions?.titre ?? "—"],
      ["Entrée en vigueur", sig.chartes_versions?.entree_en_vigueur_le ? new Date(sig.chartes_versions.entree_en_vigueur_le).toLocaleDateString("fr-FR") : "—"],
      ["Date de signature", new Date(sig.signe_le).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })],
      ["Méthode d'authentification", sig.methode_auth],
      ["Adresse IP", sig.ip_signataire ?? "non capturée"],
      ["Navigateur (UA)", (sig.user_agent ?? "").slice(0, 100)],
      ["Hash du contenu signé", sig.charte_hash],
      ["Identifiant de signature", sig.id],
    ];

    doc.setFontSize(10); doc.setTextColor(40);
    for (const [label, value] of rows) {
      doc.setFont("helvetica", "bold");
      doc.text(label, margin, y);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(value, 110);
      doc.text(lines, margin + 55, y);
      y += Math.max(6, lines.length * 5);
      if (y > 270) { doc.addPage(); y = margin; }
    }

    y += 8;
    doc.setDrawColor(200); doc.line(margin, y, 210 - margin, y); y += 8;
    doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(100);
    const legal = doc.splitTextToSize(
      "Ce document constitue une preuve électronique conforme à l'article 1366 du Code civil et au règlement eIDAS. " +
      "La signature est horodatée et immuable. Le hash SHA-256 du contenu garantit l'intégrité du texte signé. " +
      "Toute reproduction ou modification est interdite. Conservé par LesNoces.net dans un bucket privé à accès restreint.",
      170
    );
    doc.text(legal, margin, y);

    const pdfBytes = doc.output("arraybuffer");

    const path = `${sig.prestataire_id}/${sig.id}.pdf`;
    const { error: upErr } = await adminClient.storage.from("signatures-preuve").upload(path, new Uint8Array(pdfBytes), {
      contentType: "application/pdf",
      upsert: false,
    });
    if (upErr && !String(upErr.message).includes("already exists")) throw upErr;

    // Write-once callback : le trigger autorise UPDATE pdf_preuve_url uniquement
    // si la valeur actuelle est NULL. La clause `IS NULL` est une ceinture en plus.
    await adminClient
      .from("signatures_charte")
      .update({ pdf_preuve_url: path })
      .eq("id", sig.id)
      .is("pdf_preuve_url", null);

    const { data: signed } = await adminClient.storage.from("signatures-preuve").createSignedUrl(path, 60 * 60 * 24 * 365);
    return new Response(JSON.stringify({ success: true, path, signed_url: signed?.signedUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
