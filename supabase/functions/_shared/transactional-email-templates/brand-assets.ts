// URLs publiques des logos LesNoces hébergés dans Supabase Storage (bucket public email-assets).
// Utilisées à la fois par les templates React Email (auth + transactional) et par le
// moteur de rendu HTML email-safe (build-designed-html.ts).

const BASE = 'https://egbohbwiywgyyculswvf.supabase.co/storage/v1/object/public/email-assets/brand'

export const BRAND_ASSETS = {
  ringAbysse: `${BASE}/logo-ring-abysse.png`,
  ringGold: `${BASE}/logo-ring-gold.png`,
  wordmarkWhite: `${BASE}/logo-wordmark-white.png`,
  wordmarkAbysse: `${BASE}/logo-wordmark-abysse.png`,
  signatureNathalie: `${BASE}/signature-n-nathalie.png`,
} as const

// Alias historique (auth templates)
export const LOGO_URL = BRAND_ASSETS.wordmarkAbysse
