// brevo-provision-schema — crée (de façon idempotente) le schéma d'attributs
// de contact côté Brevo. Admin-only. Aucun contact n'est créé ni synchronisé.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  brevoFetch,
  BrevoError,
  BREVO_ERROR_LABELS,
} from "../_shared/brevo-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type SimpleType = "text" | "date" | "boolean" | "float";

const SIMPLE_ATTRIBUTES: Array<{ name: string; type: SimpleType }> = [
  // text
  { name: "PRESTA_NOM", type: "text" },
  { name: "NOM_COMMERCIAL", type: "text" },
  // text — référentiels métier vivants (ex-category ouvertes, option B)
  { name: "REGION", type: "text" },
  { name: "CATEGORIE", type: "text" },
  { name: "PRESTA_CAT", type: "text" },
  { name: "PRESTA_REGION", type: "text" },
  // date
  { name: "DATE_CONTACT", type: "date" },
  { name: "DATE_EVENT", type: "date" },
  { name: "DERNIERE_CONNEXION", type: "date" },
  { name: "FIN_ESSAI", type: "date" },
  { name: "DATE_PREMIERE_PUBLI", type: "date" },
  // boolean
  { name: "CONSENTEMENT_MKT", type: "boolean" },
  { name: "A_UN_COMPTE", type: "boolean" },
  // float
  { name: "NB_DEMANDES_MARIES", type: "float" },
  { name: "NB_FAVORIS", type: "float" },
  { name: "NB_VUES", type: "float" },
  { name: "NB_DEMANDES_PRESTA", type: "float" },
  { name: "TAUX_REPONSE", type: "float" },
  { name: "NOTE_MOYENNE", type: "float" },
  { name: "NB_ECHECS_PAIEMENT", type: "float" },
];

/** Attributs natifs Brevo réutilisés tels quels — jamais recréés. */
const NATIVE_REUSED = ["PRENOM", "NOM"];


const FIXED_CATEGORIES: Record<string, string[]> = {
  TYPE_EVENEMENT: ["mariage", "evenement_entreprise", "cocktail", "autre"],
  CYCLE_VIE: ["essai", "abonne", "resilie", "churned", "suspendu"],
  ORIGINE: ["inscription_admin", "auto_inscription", "migration"],

    "brouillon",
    "pre_inscrit",
    "a_completer",
    "en_attente",
    "a_corriger",
    "validee",
    "actif",
    "suspendu",
    "archive",
    "resilie_expire",
  ],
};

interface BrevoAttribute {
  name: string;
  category: string;
  type?: string;
  enumeration?: Array<{ value: number; label: string }>;
}

type Etat = "cree" | "deja_present" | "complete" | "echec";

interface Ligne {
  attribut: string;
  type: string;
  etat: Etat;
  motif?: string;
  valeurs?: string[];
}

const FAST = { retries: 1, timeoutMs: 10_000 };

function describeError(err: unknown): string {
  if (err instanceof BrevoError) {
    return `${BREVO_ERROR_LABELS[err.kind]}${err.status ? ` (HTTP ${err.status})` : ""} — ${err.message}`;
  }
  return err instanceof Error ? err.message : String(err);
}

async function listAttributes(): Promise<BrevoAttribute[]> {
  const res = await brevoFetch<{ attributes?: BrevoAttribute[] }>(
    "/contacts/attributes",
    { method: "GET" },
    FAST,
  );
  return res?.attributes ?? [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, message: "Non autorisé" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ ok: false, message: "Non autorisé" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);
    const roles = (callerRoles ?? []).map((r: { role: string }) => r.role);
    if (!roles.includes("admin") && !roles.includes("super_admin")) {
      return json({ ok: false, message: "Accès refusé : rôle admin requis" }, 403);
    }

    // État de départ (lecture seule)
    let existing: BrevoAttribute[];
    try {
      existing = await listAttributes();
    } catch (err) {
      return json({ ok: false, message: describeError(err) }, 200);
    }
    const byName = new Map(existing.map((a) => [a.name.toUpperCase(), a]));

    const lignes: Ligne[] = [];

    // 1) Attributs natifs réutilisés
    for (const name of NATIVE_REUSED) {
      const found = byName.get(name);
      lignes.push({
        attribut: name,
        type: found?.type ?? "text",
        etat: found ? "deja_present" : "echec",
        motif: found ? "Attribut natif Brevo, réutilisé tel quel" : "Attribut natif introuvable",
      });
    }

    // 2) Attributs simples (text / date / boolean / float)
    for (const attr of SIMPLE_ATTRIBUTES) {
      if (byName.has(attr.name)) {
        lignes.push({ attribut: attr.name, type: attr.type, etat: "deja_present" });
        continue;
      }
      try {
        await brevoFetch(
          `/contacts/attributes/normal/${encodeURIComponent(attr.name)}`,
          { method: "POST", body: JSON.stringify({ type: attr.type }) },
          FAST,
        );
        lignes.push({ attribut: attr.name, type: attr.type, etat: "cree" });
      } catch (err) {
        // Course / doublon : Brevo renvoie 400 duplicate_parameter
        const msg = describeError(err);
        const duplicate = /exist|duplicate/i.test(msg);
        lignes.push({
          attribut: attr.name,
          type: attr.type,
          etat: duplicate ? "deja_present" : "echec",
          motif: duplicate ? undefined : msg,
        });
      }
    }

    // 3) Category à valeurs figées — création + vérification/complément des valeurs
    for (const [name, labels] of Object.entries(FIXED_CATEGORIES)) {
      const found = byName.get(name);
      try {
        if (!found) {
          await brevoFetch(
            `/contacts/attributes/category/${encodeURIComponent(name)}`,
            {
              method: "POST",
              body: JSON.stringify({
                type: "category",
                enumeration: labels.map((label, i) => ({ value: i + 1, label })),
              }),
            },
            FAST,
          );
          lignes.push({ attribut: name, type: "category", etat: "cree", valeurs: labels });
          continue;
        }


        const current = found.enumeration ?? [];
        const currentLabels = current.map((e) => e.label);
        const missing = labels.filter((l) => !currentLabels.includes(l));
        if (missing.length === 0) {
          lignes.push({
            attribut: name,
            type: "category",
            etat: "deja_present",
            valeurs: currentLabels,
          });
          continue;
        }
        let nextValue = current.reduce((m, e) => Math.max(m, e.value), 0);
        const merged = [
          ...current,
          ...missing.map((label) => ({ value: ++nextValue, label })),
        ];
        await brevoFetch(
          `/contacts/attributes/category/${encodeURIComponent(name)}`,
          { method: "PUT", body: JSON.stringify({ type: "category", enumeration: merged }) },
          FAST,
        );
        lignes.push({
          attribut: name,
          type: "category",
          etat: "complete",
          motif: `Valeurs ajoutées : ${missing.join(", ")}`,
          valeurs: merged.map((e) => e.label),
        });
      } catch (err) {
        lignes.push({
          attribut: name,
          type: "category",
          etat: "echec",
          motif: describeError(err),
          valeurs: labels,
        });
      }
    }

    // Vérification finale des valeurs des category figées
    let verification: Record<string, { attendues: string[]; presentes: string[]; conforme: boolean }> = {};
    try {
      const after = await listAttributes();
      const afterByName = new Map(after.map((a) => [a.name.toUpperCase(), a]));
      verification = Object.fromEntries(
        Object.entries(FIXED_CATEGORIES).map(([name, labels]) => {
          const presentes = (afterByName.get(name)?.enumeration ?? []).map((e) => e.label);
          return [
            name,
            {
              attendues: labels,
              presentes,
              conforme: labels.every((l) => presentes.includes(l)),
            },
          ];
        }),
      );
    } catch (err) {
      console.error("[brevo-provision-schema] vérification impossible", describeError(err));
    }

    const resume = {
      crees: lignes.filter((l) => l.etat === "cree").length,
      deja_presents: lignes.filter((l) => l.etat === "deja_present").length,
      completes: lignes.filter((l) => l.etat === "complete").length,
      echecs: lignes.filter((l) => l.etat === "echec").length,
    };
    console.log("[brevo-provision-schema] terminé", resume);

    return json({ ok: resume.echecs === 0, resume, attributs: lignes, verification_categories: verification });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[brevo-provision-schema] erreur inattendue", message);
    return json({ ok: false, message }, 500);
  }
});
