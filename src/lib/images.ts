/**
 * Helper de transformation d'URL pour les images Supabase Storage.
 *
 * Réécrit `/storage/v1/object/public/...` en `/storage/v1/render/image/public/...`
 * et ajoute les paramètres de redimensionnement/qualité.
 *
 * Pas de `format=webp` forcé : Supabase sert WebP automatiquement via
 * content-negotiation (Accept header), ce qui évite de casser Safari < 14.
 *
 * Les URLs non-Supabase (placeholders, images externes, etc.) sont retournées
 * telles quelles.
 */

export type ImagePreset = "cover" | "thumb" | "hero";

const PRESETS: Record<ImagePreset, { width: number; quality: number }> = {
  cover: { width: 1200, quality: 80 },
  thumb: { width: 400, quality: 75 },
  hero: { width: 1600, quality: 80 },
};

const OBJECT_PATH = "/storage/v1/object/public/";
const RENDER_PATH = "/storage/v1/render/image/public/";

export function getImageUrl(
  url: string | null | undefined,
  preset: ImagePreset,
): string {
  if (!url) return "";
  if (!url.includes(OBJECT_PATH)) return url;

  const { width, quality } = PRESETS[preset];
  const rewritten = url.replace(OBJECT_PATH, RENDER_PATH);
  const sep = rewritten.includes("?") ? "&" : "?";
  return `${rewritten}${sep}width=${width}&quality=${quality}`;
}
