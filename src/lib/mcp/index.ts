import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchPrestataires from "./tools/search-prestataires";
import getPrestataire from "./tools/get-prestataire";
import listCategories from "./tools/list-categories";
import getMe from "./tools/get-me";
import listMyDemandes from "./tools/list-my-demandes";

// Construit l'issuer OAuth à partir du project ref Supabase, jamais depuis
// SUPABASE_URL (le proxy .lovable.cloud casserait la vérification RFC 8414).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "lesnoces-mcp",
  title: "LesNoces",
  version: "0.1.0",
  instructions:
    "Outils LesNoces : marketplace de prestataires de mariage. Utilise search_prestataires et get_prestataire pour explorer les fiches publiques (statut actif uniquement). list_categories renvoie la taxonomie. get_me et list_my_demandes_devis nécessitent une session utilisateur et respectent les politiques d'accès (RLS) : un client voit ses demandes envoyées, un prestataire celles reçues.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchPrestataires, getPrestataire, listCategories, getMe, listMyDemandes],
});
