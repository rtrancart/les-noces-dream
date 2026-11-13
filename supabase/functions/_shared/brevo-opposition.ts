// Opposition marketing — vérité globale à l'adresse email.
// Utilisé par les flux sortants pour ne jamais réinscrire un contact opposé
// dans une liste marketing, et par le webhook entrant pour matérialiser le signal.
import { brevoFetch } from "./brevo-client.ts";

/** Liste technique : réceptacle des contacts opposés, jamais utilisée en envoi marketing. */
export const LISTE_DESINSCRITS = "desinscrits_marketing";
/** Liste d'audience prestataires (B2B). */
export const LISTE_PRESTATAIRES = "prestataires";
/** Préfixe des listes « catégorie contactée » côté mariés. */
export const PREFIXE_LISTE_CONTACT = "contact_";

const CALL_OPTIONS = { retries: 1, timeoutMs: 10_000 };

/** Une liste est marketing si c'est l'audience prestataires ou une liste contact_{categorie}. */
export function estListeMarketing(nom: string): boolean {
  return nom === LISTE_PRESTATAIRES || nom.startsWith(PREFIXE_LISTE_CONTACT);
}

const listCache = new Map<string, number>();
let folderIdCache: number | null = null;

async function ensureFolderId(): Promise<number> {
  if (folderIdCache !== null) return folderIdCache;
  const res = await brevoFetch<{ folders?: { id: number; name: string }[] }>(
    "/contacts/folders?limit=50&offset=0",
    { method: "GET" },
    CALL_OPTIONS,
  );
  const folders = res?.folders ?? [];
  const found = folders.find((f) => f.name?.toLowerCase() === "lesnoces") ?? folders[0];
  if (found) {
    folderIdCache = found.id;
    return found.id;
  }
  const created = await brevoFetch<{ id: number }>(
    "/contacts/folders",
    { method: "POST", body: JSON.stringify({ name: "LesNoces" }) },
    CALL_OPTIONS,
  );
  folderIdCache = created.id;
  return created.id;
}

/** Toutes les listes Brevo, paginées (id -> nom). */
export async function chargerListes(): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const limit = 50;
  for (let offset = 0; offset < 2000; offset += limit) {
    const page = await brevoFetch<{ lists?: { id: number; name: string }[] }>(
      `/contacts/lists?limit=${limit}&offset=${offset}`,
      { method: "GET" },
      CALL_OPTIONS,
    );
    const lists = page?.lists ?? [];
    for (const l of lists) {
      map.set(l.id, l.name);
      listCache.set(l.name, l.id);
    }
    if (lists.length < limit) break;
  }
  return map;
}

/** Retrouve la liste par nom, la crée si absente. */
export async function ensureList(nom: string): Promise<number> {
  const cached = listCache.get(nom);
  if (cached) return cached;
  await chargerListes();
  const found = listCache.get(nom);
  if (found) return found;

  const folderId = await ensureFolderId();
  const created = await brevoFetch<{ id: number }>(
    "/contacts/lists",
    { method: "POST", body: JSON.stringify({ name: nom, folderId }) },
    CALL_OPTIONS,
  );
  listCache.set(nom, created.id);
  return created.id;
}

/** Id de la liste technique des désinscrits (créée à la volée si besoin). */
export function ensureListeDesinscrits(): Promise<number> {
  return ensureList(LISTE_DESINSCRITS);
}

type AdminLike = {
  // deno-lint-ignore no-explicit-any
  from: (table: string) => any;
};

/** Raisons de suppressed_emails qui valent opposition marketing (hard bounce, plainte). */
export const RAISONS_BLOCAGE_MARKETING = ["bounce", "complaint"] as const;

/** true si la raison d'un blocage email vaut opposition marketing. */
export function raisonBloqueMarketing(raison: string | null | undefined): boolean {
  return (RAISONS_BLOCAGE_MARKETING as readonly string[]).includes(raison ?? "");
}

/**
 * true si l'adresse s'est opposée au marketing (toute origine confondue),
 * ou si elle a eu un hard bounce / une plainte (suppressed_emails).
 */
export async function estOppose(admin: AdminLike, email: string): Promise<boolean> {
  const normalise = email.toLowerCase().trim();
  if (!normalise) return false;
  const { data } = await admin
    .from("oppositions_marketing")
    .select("email")
    .eq("email", normalise)
    .maybeSingle();
  if (data) return true;
  const { data: blocages } = await admin
    .from("suppressed_emails")
    .select("reason")
    .eq("email", normalise)
    .in("reason", [...RAISONS_BLOCAGE_MARKETING])
    .limit(1);
  return Array.isArray(blocages) && blocages.length > 0;
}
