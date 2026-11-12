import { supabase } from "@/integrations/supabase/client";

export type RecoAtelier = {
  prestataire_id: string;
  raison: string;
  nom_commercial?: string;
  url?: string;
  photo_principale?: string | null;
  categorie?: string | null;
  sous_categorie?: string | null;
  ville?: string | null;
  hors_zone?: boolean;
};

export type MessageAtelier = {
  id: string;
  role: "user" | "assistant";
  contenu: string;
  recommandations: RecoAtelier[] | null;
  created_at: string;
};

export type ConversationAtelier = { id: string; titre: string | null; updated_at: string };

export type ReponseAssistant = {
  conversation_id: string;
  message_id: string | null;
  message: string;
  recommandations: RecoAtelier[];
  messages_restants: number | null;
};

/** Messages aimables pour les refus de la passerelle IA. */
export const MESSAGES_ERREUR: Record<string, string> = {
  quota_atteint: "Vous avez utilisé tous vos messages pour aujourd'hui. L'assistant vous retrouve demain, dès minuit.",
  mode_degrade: "L'assistant est très sollicité en ce moment. Merci de réessayer un peu plus tard.",
  budget_suspendu: "L'assistant fait une courte pause. Il sera de retour très bientôt, merci de votre patience.",
  usage_indisponible: "L'assistant n'est pas encore disponible. Nous vous préviendrons dès son ouverture.",
  acces_refuse: "L'assistant est réservé aux futurs mariés.",
  non_authentifie: "Votre session a expiré. Reconnectez-vous pour continuer.",
};
const ERREUR_DEFAUT = "L'assistant n'a pas pu répondre. Réessayez dans un instant.";

export class ErreurAtelier extends Error {
  code: string;
  constructor(code: string) {
    super(MESSAGES_ERREUR[code] ?? ERREUR_DEFAUT);
    this.code = code;
  }
}

async function appeler<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ai-gateway", { body });
  if (error) {
    let code = "erreur";
    try {
      const ctx = (error as { context?: Response }).context;
      const j = ctx ? await ctx.json() : null;
      code = j?.error ?? code;
    } catch { /* corps illisible */ }
    throw new ErreurAtelier(code);
  }
  return data as T;
}

export const envoyerMessage = (message: string, conversation_id?: string) =>
  appeler<ReponseAssistant>({ usage: "assistant", donnees: { message, ...(conversation_id ? { conversation_id } : {}) } });

export const lireMessagesRestants = () =>
  appeler<{ messages_restants: number | null }>({ action: "quota_assistant" }).then((d) => d.messages_restants);

export const SUGGESTIONS = [
  { label: "Trouver un lieu", message: "Nous cherchons un lieu de réception pour notre mariage. Pouvez-vous nous aider ?" },
  { label: "Un photographe naturel", message: "Nous cherchons un photographe au style naturel." },
  { label: "Par quoi commencer ?", message: "Par quoi devons-nous commencer pour préparer notre mariage ?" },
  { label: "Mon budget est-il réaliste ?", message: "Notre budget est-il réaliste ? Voici notre situation :" },
];

export const ETAPES_ATTENTE = ["Je lis votre demande…", "Je cherche parmi nos prestataires…", "Je rédige ma réponse…"];
