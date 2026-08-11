// pennylane-test-e2e — rejoue la chaîne complète de facturation Pennylane
// (prestataire → client → facture → ligne en base) avec une facture de démo.
// Réservé aux admins. Utilise exactement le code de production (API V2).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { syncStripeInvoiceToPennylane } from "../_shared/pennylane-sync.ts";
import { pennylaneFetch, PennylaneError } from "../_shared/pennylane-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface Etape {
  libelle: string;
  ok: boolean;
  detail?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const etapes: Etape[] = [];
  const push = (libelle: string, ok: boolean, detail?: string) => {
    etapes.push({ libelle, ok, detail });
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, motif: "Non autorisé" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ ok: false, motif: "Non autorisé" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);
    const roles = (callerRoles ?? []).map((r: { role: string }) => r.role);
    if (!roles.includes("admin") && !roles.includes("super_admin")) {
      return json({ ok: false, motif: "Accès refusé : rôle admin requis" }, 403);
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action: string = body.action ?? "run";

    // ---------------------------------------------------------------- nettoyage
    if (action === "cleanup") {
      const stripeInvoiceId: string | undefined = body.stripe_invoice_id;
      if (!stripeInvoiceId || !stripeInvoiceId.startsWith("test_e2e_")) {
        return json({ ok: false, motif: "Identifiant de facture de test invalide" }, 400);
      }

      const { data: row } = await admin
        .from("factures_pennylane")
        .select("id, pennylane_invoice_id, numero")
        .eq("stripe_invoice_id", stripeInvoiceId)
        .maybeSingle();

      let pennylaneSupprime = false;
      let messagePennylane: string | null = null;
      if (row?.pennylane_invoice_id) {
        try {
          await pennylaneFetch(`/customer_invoices/${row.pennylane_invoice_id}`, {
            method: "DELETE",
          }, { retries: 0, timeoutMs: 10_000 });
          pennylaneSupprime = true;
        } catch (err) {
          messagePennylane = err instanceof PennylaneError
            ? `${err.kind}: ${err.message}`
            : err instanceof Error
            ? err.message
            : String(err);
        }
      }

      await admin.from("factures_pennylane").delete().eq("stripe_invoice_id", stripeInvoiceId);

      return json({
        ok: true,
        ligne_supprimee: true,
        pennylane_supprime: pennylaneSupprime,
        message_pennylane: messagePennylane,
        numero: row?.numero ?? null,
      });
    }

    // ------------------------------------------------------------------ test e2e
    let prestataireId: string | null = body.prestataire_id ?? null;
    if (!prestataireId) {
      const { data: presta } = await admin
        .from("prestataires")
        .select("id, nom_commercial")
        .ilike("nom_commercial", "%test%")
        .limit(1)
        .maybeSingle();
      prestataireId = presta?.id ?? null;
      if (!prestataireId) {
        const { data: fallback } = await admin
          .from("prestataires")
          .select("id")
          .eq("statut", "actif")
          .limit(1)
          .maybeSingle();
        prestataireId = fallback?.id ?? null;
      }
    }
    if (!prestataireId) {
      return json({ ok: false, motif: "Aucun prestataire disponible pour le test" }, 400);
    }

    const { data: presta } = await admin
      .from("prestataires")
      .select("id, nom_commercial, raison_sociale, email_contact, adresse, code_postal, ville, siret, tva_intracom")
      .eq("id", prestataireId)
      .maybeSingle();

    if (!presta) return json({ ok: false, motif: "Prestataire introuvable" }, 404);
    push(
      "Prestataire cible",
      true,
      `${presta.raison_sociale ?? presta.nom_commercial ?? presta.id}${
        presta.siret ? ` · SIRET ${presta.siret}` : " · SIRET non renseigné"
      }`,
    );

    const now = Math.floor(Date.now() / 1000);
    const stripeInvoiceId = `test_e2e_${now}`;
    const fakeInvoice = {
      id: stripeInvoiceId,
      number: `TEST-${now}`,
      created: now,
      due_date: now,
      subtotal: 100,
      tax: 20,
      total: 120,
      amount_paid: 120,
      currency: "eur",
      paid: true,
      status: "paid",
      payment_intent: null,
      invoice_pdf: null,
      hosted_invoice_url: null,
      lines: { data: [{ description: "Facture de démonstration Lesnoces.net (test technique)" }] },
    };
    push("Facture Stripe de démo construite", true, `1,00 € HT + 20 % TVA · réf. ${stripeInvoiceId}`);

    const result = await syncStripeInvoiceToPennylane(admin, prestataireId, fakeInvoice, {
      extraInvoiceFields: { draft: true },
    });

    if (!result.ok) {
      push("Synchronisation Pennylane", false, result.error ?? "Échec inconnu");
      return json({ ok: false, etapes, stripe_invoice_id: stripeInvoiceId, motif: result.error });
    }

    push("Client Pennylane", true, `id ${result.customerId}`);
    push(
      "Facture créée dans Pennylane",
      Boolean(result.pennylaneInvoiceId),
      result.pennylaneInvoiceId
        ? `id ${result.pennylaneInvoiceId}${result.numero ? ` · n° ${result.numero}` : ""}`
        : "Pennylane n'a pas renvoyé d'identifiant de facture",
    );

    const { data: ligne } = await admin
      .from("factures_pennylane")
      .select("id, numero, montant_ttc_cents, statut, pdf_url, erreur")
      .eq("stripe_invoice_id", stripeInvoiceId)
      .maybeSingle();

    push(
      "Ligne enregistrée en base (visible espace prestataire)",
      Boolean(ligne?.id),
      ligne ? `${(ligne.montant_ttc_cents ?? 0) / 100} € · statut ${ligne.statut}` : "Ligne absente",
    );

    return json({
      ok: etapes.every((e) => e.ok),
      etapes,
      stripe_invoice_id: stripeInvoiceId,
      prestataire: presta.raison_sociale ?? presta.nom_commercial,
      pdf_url: result.pdfUrl ?? ligne?.pdf_url ?? null,
      numero: result.numero ?? ligne?.numero ?? null,
    });
  } catch (err) {
    const message = err instanceof PennylaneError
      ? `${err.kind}: ${err.message}`
      : err instanceof Error
      ? err.message
      : String(err);
    console.error("[pennylane-test-e2e] erreur", message);
    return json({ ok: false, motif: "Erreur inattendue", message, etapes }, 500);
  }
});
