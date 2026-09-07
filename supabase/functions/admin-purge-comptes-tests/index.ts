// Fonction à usage unique : annule les souscriptions Stripe des 4 comptes de test
// listés en dur ci-dessous, puis supprime intégralement les comptes.
// À SUPPRIMER immédiatement après exécution.
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Allowlist stricte : aucun autre compte ne peut être supprimé par cette fonction.
const CIBLES = [
  { prestataire_id: "ea649f85-03c2-48a7-b96b-3deaae905827", user_id: "e2d2b4b8-d5d5-4102-8c8d-b926a043d18c", sub: "sub_1TtYQIA7nRLOMZvBmBqRcLOQ", cus: "cus_UtJTwMSyPneIbh" },
  { prestataire_id: "e95fac19-04c2-4d83-96dc-11f09275b600", user_id: "bf8aa5ef-0530-4f75-9eac-5b463e3d684d", sub: "sub_1Ttu7bA7nRLOMZvBEE2uPiXW", cus: "cus_UthWtzIWbHm019" },
  { prestataire_id: "e1adfb53-71bd-49e5-83d3-d5585755eb6d", user_id: "90884f6e-b978-4d6d-b257-d3f3347cfe9b", sub: "sub_1UBrygA7nRLOMZvBf9LHAtma", cus: "cus_VCGUiPJy5KzrdE" },
  { prestataire_id: "6e9aa444-9e80-497c-8272-1718bf7fcda9", user_id: "5d2e295e-1a47-4cc3-9439-29547fd99f2d", sub: null, cus: null },
];

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-11-20.acacia",
});

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rapport: Record<string, unknown>[] = [];

  for (const cible of CIBLES) {
    const ligne: Record<string, unknown> = { prestataire_id: cible.prestataire_id };

    // 1. Annulation Stripe
    if (cible.sub) {
      try {
        const s = await stripe.subscriptions.cancel(cible.sub, { prorate: false });
        ligne.stripe_subscription = s.status;
      } catch (e) {
        ligne.stripe_subscription = `erreur: ${(e as Error).message}`;
      }
    } else {
      ligne.stripe_subscription = "aucune";
    }
    if (cible.cus) {
      try {
        await stripe.customers.del(cible.cus);
        ligne.stripe_customer = "supprimé";
      } catch (e) {
        ligne.stripe_customer = `erreur: ${(e as Error).message}`;
      }
    }

    // 2. Nettoyage cascade + suppression du compte auth
    try {
      const { error: rpcErr } = await admin.rpc("admin_delete_user_cascade", {
        p_user_id: cible.user_id,
      });
      if (rpcErr) throw rpcErr;
      const { error: delErr } = await admin.auth.admin.deleteUser(cible.user_id);
      if (delErr) throw delErr;
      ligne.compte = "supprimé";
    } catch (e) {
      ligne.compte = `erreur: ${(e as Error).message}`;
    }

    rapport.push(ligne);
  }

  return new Response(JSON.stringify({ rapport }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
