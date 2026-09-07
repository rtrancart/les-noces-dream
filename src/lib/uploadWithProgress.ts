import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/**
 * Envoi d'un fichier vers Supabase Storage avec suivi de progression réel.
 * supabase-js ne remonte pas la progression : on passe par XHR sur l'API REST
 * Storage, avec le jeton de la session en cours.
 */
export function uploadWithProgress(
  bucket: string,
  path: string,
  file: File,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<{ error: string | null }> {
  return new Promise(async (resolve) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return resolve({ error: "Session expirée, reconnectez-vous." });

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", SUPABASE_KEY);
    xhr.setRequestHeader("x-upsert", "true");
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve({ error: null });
      } else {
        let message = `Échec de l'envoi (${xhr.status})`;
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (parsed?.message) message = parsed.message;
        } catch {
          /* réponse non JSON : on garde le message générique */
        }
        resolve({ error: message });
      }
    };
    xhr.onerror = () => resolve({ error: "Connexion interrompue pendant l'envoi." });
    xhr.onabort = () => resolve({ error: "Envoi annulé." });

    signal?.addEventListener("abort", () => xhr.abort());

    xhr.send(file);
  });
}
