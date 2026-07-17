// Coquille email commune (header + footer + signature) pour tous les templates
// de l'onglet Emails du back-office. L'admin n'édite que le corps ; la coquille
// est appliquée automatiquement au moment de l'envoi (send-transactional-email)
// et pour l'aperçu (admin-email-textes list → shellHead / shellFoot).

import { BRAND_ASSETS } from './transactional-email-templates/brand-assets.ts'

// -------------------- Palette & typos --------------------
const C = {
  or: '#A57D27',
  champagne: '#C9AF78',
  petrole: '#2D4356',
  abysse: '#0F141E',
  paper: '#FFFFFF',
  muted: '#7A7A7A',
}
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif"
const SANS = "Montserrat, Arial, sans-serif"

export type Signer = 'nathalie' | 'equipe' | 'none'

// Métadonnées de coquille par template : texte d'aperçu inbox + signataire.
// Utilisé à la fois au seed (build-designed-html.ts) et à l'envoi
// (send-transactional-email) pour reconstituer une coquille cohérente.
export const SHELL_META: Record<string, { preview: string; signer: Signer }> = {
  invitation_prestataire: {
    preview: "Votre fiche a été créée — il ne reste qu'à la revendiquer",
    signer: 'nathalie',
  },
  relance_signature_charte: {
    preview: 'Votre fiche vous attend — quelques minutes suffisent',
    signer: 'nathalie',
  },
  notif_nouvelle_soumission_fiche: {
    preview: 'Un prestataire vient de soumettre sa fiche pour validation',
    signer: 'none',
  },
  validation_publication_fiche: {
    preview: "Votre période découverte commence aujourd'hui",
    signer: 'nathalie',
  },
  notif_nouvelle_version_charte: {
    preview: 'Version {{numero_version}} — merci de la relire et signer',
    signer: 'equipe',
  },
  notif_reponse_client_avec_compte: {
    preview: 'Lisez et répondez depuis votre messagerie',
    signer: 'none',
  },
  notif_reponse_client_sans_compte: {
    preview: 'Accédez à votre conversation en un clic',
    signer: 'none',
  },
  notif_reponse_presta: {
    preview: 'Nouvelle réponse dans votre messagerie',
    signer: 'none',
  },
  demande_reactivation: {
    preview: 'Un prestataire archivé souhaite réactiver sa fiche',
    signer: 'none',
  },
  notif_nouveau_contact_presta: {
    preview: 'Répondez sous 24h pour maximiser vos chances',
    signer: 'equipe',
  },
  notif_nouveau_contact_presta_sans_compte: {
    preview: "Le client n'a pas de compte LesNoces",
    signer: 'equipe',
  },
  impaye_premier_echec: { preview: 'Un souci sur votre dernier paiement', signer: 'equipe' },
  impaye_rappel_intermediaire: { preview: "Second essai de paiement en préparation", signer: 'equipe' },
  impaye_suspension: { preview: 'Votre fiche vient d\'être suspendue', signer: 'equipe' },
  suspension_charte_exemption_expiree: { preview: 'Signature de la charte requise', signer: 'nathalie' },
}

// -------------------- Blocs de coquille --------------------
function headerBlock() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.abysse}"><tr><td align="center" style="padding:36px 30px 24px">
  <img src="${BRAND_ASSETS.wordmarkWhite}" width="180" alt="LesNoces.net" style="display:block;margin:0 auto 12px;height:auto;border:0" />
  <div style="font-family:${SANS};font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:${C.champagne};font-weight:600">Mariage &amp; événementiel d'exception</div>
</td></tr>
<tr><td align="center" style="padding:14px 20px 16px;border-top:1px solid rgba(255,255,255,.14);font-family:${SANS}">
  <a href="https://lesnoces.net/" style="color:#e8e0cf;text-decoration:none;font-size:10px;letter-spacing:.13em;text-transform:uppercase;font-weight:600;margin:0 9px">Accueil</a>
  <span style="color:rgba(255,255,255,.35);font-size:8px">◆</span>
  <a href="https://lesnoces.net/prestataires" style="color:#e8e0cf;text-decoration:none;font-size:10px;letter-spacing:.13em;text-transform:uppercase;font-weight:600;margin:0 9px">Trouver un prestataire</a>
  <span style="color:rgba(255,255,255,.35);font-size:8px">◆</span>
  <a href="https://lesnoces.net/connexion" style="color:#e8e0cf;text-decoration:none;font-size:10px;letter-spacing:.13em;text-transform:uppercase;font-weight:600;margin:0 9px">Mon espace</a>
</td></tr></table>`
}

function footerBlock() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.abysse}"><tr><td align="center" style="padding:32px 40px 28px;font-family:${SANS};color:#b7b1a6">
  <img src="${BRAND_ASSETS.wordmarkWhite}" width="140" alt="LesNoces.net" style="display:block;margin:0 auto 12px;height:auto;border:0" />
  <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:${C.champagne};margin:0 0 16px">Prestataires sélectionnés à la main</div>
  <div style="font-size:12.5px;color:#cbc5ba;line-height:1.8">📞 02 96 01 00 17 — du lundi au vendredi, 10h à 13h<br />📧 <a href="mailto:contact@lesnoces.net" style="color:#cbc5ba;text-decoration:none">contact@lesnoces.net</a></div>
  <div style="height:1px;background:rgba(255,255,255,.08);margin:20px 0"></div>
  <div style="font-size:10.5px;color:#6f6a62;line-height:1.7">LesNoces.net — Marketplace de prestataires haut de gamme.</div>
</td></tr></table>`
}

function signatureBlock(signer: Signer) {
  if (signer === 'none') return ''
  if (signer === 'nathalie') {
    return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:28px;border-top:1px solid ${C.champagne}"><tr><td style="padding-top:20px;font-family:${SANS}">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td width="56" style="width:56px;vertical-align:top">
      <div style="width:56px;height:56px;line-height:56px;text-align:center;background:${C.or};color:#FFFFFF;font-family:${SERIF};font-style:italic;font-size:28px;border-radius:50%">N</div>
    </td>
    <td style="padding-left:16px;vertical-align:middle">
      <div style="font-size:13px;color:${C.muted}">Bien à vous,</div>
      <div style="font-family:${SERIF};font-style:italic;font-size:24px;color:${C.or};line-height:1.1">Nathalie</div>
      <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${C.petrole};font-weight:600;margin-top:4px">Fondatrice</div>
    </td>
  </tr></table>
  <div style="font-size:12px;color:${C.muted};margin-top:12px">📞 02 96 01 00 17 · 📧 <a href="mailto:contact@lesnoces.net" style="color:${C.or};text-decoration:none">contact@lesnoces.net</a></div>
  <div style="font-family:${SERIF};font-style:italic;font-size:13px;color:#9b9384;margin-top:8px">« Nous sélectionnons ceux que nous serions heureux de recommander à nos propres mariés. »</div>
  <img src="${BRAND_ASSETS.wordmarkAbysse}" height="16" alt="LesNoces.net" style="display:block;margin-top:14px;border:0" />
</td></tr></table>`
  }
  // equipe
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:28px;border-top:1px solid ${C.champagne}"><tr><td style="padding-top:20px;font-family:${SANS}">
  <div style="font-size:13px;color:${C.muted}">À très bientôt,</div>
  <div style="font-family:${SERIF};font-style:italic;font-size:22px;color:${C.or};line-height:1.1;margin-top:2px">L'équipe LesNoces</div>
  <div style="font-size:12px;color:${C.muted};margin-top:10px">📞 02 96 01 00 17 · 📧 <a href="mailto:contact@lesnoces.net" style="color:${C.or};text-decoration:none">contact@lesnoces.net</a></div>
  <img src="${BRAND_ASSETS.wordmarkAbysse}" height="16" alt="LesNoces.net" style="display:block;margin-top:14px;border:0" />
</td></tr></table>`
}

// -------------------- API publique --------------------

export function isFullHtmlDoc(html: string): boolean {
  const s = html.trimStart().toLowerCase()
  return s.startsWith('<!doctype') || s.startsWith('<html')
}

function metaFor(templateName: string): { preview: string; signer: Signer } {
  return SHELL_META[templateName] ?? { preview: '', signer: 'none' }
}

export function renderShellParts(templateName: string): { head: string; foot: string } {
  const { preview, signer } = metaFor(templateName)
  const head = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>LesNoces.net</title></head>
<body style="margin:0;padding:0;background:#f2ede2;font-family:${SANS}">
<div style="display:none;font-size:1px;color:#f2ede2;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${preview}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2ede2"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${C.paper}">
<tr><td>${headerBlock()}</td></tr>
<tr><td style="padding:32px 32px 24px">`
  const foot = `${signatureBlock(signer)}</td></tr>
<tr><td>${footerBlock()}</td></tr>
</table></td></tr></table></body></html>`
  return { head, foot }
}

export function wrapWithShell(templateName: string, bodyHtml: string): string {
  if (isFullHtmlDoc(bodyHtml)) return bodyHtml
  const { head, foot } = renderShellParts(templateName)
  return head + bodyHtml + foot
}
