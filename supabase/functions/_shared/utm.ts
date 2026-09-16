// UTM tagging for transactional emails.
// Applied once, post-render, inside send-transactional-email: every href
// pointing to the public site gets tracking params appended.
// mailto:, non-site domains, image URLs and the unsubscribe link are ignored.

const UTM_SOURCE = 'lovable'
const UTM_MEDIUM = 'email'

// templateName -> { campaign, content }
const UTM_MAP: Record<string, { campaign: string; content: string }> = {
  // Cycle de vie prestataire
  invitation_prestataire: { campaign: 'presta_onboarding', content: 'invitation_prestataire' },
  relance_decouverte_j7: { campaign: 'presta_onboarding', content: 'relance_decouverte_j7' },
  dernier_contact_tunnel_a: { campaign: 'presta_onboarding', content: 'dernier_contact_tunnel_a' },
  // Chaîne migration (reprise du parc migré)
  migration_m01_reactivation: { campaign: 'migration_2026', content: 'm01_reactivation' },
  migration_m02_relance: { campaign: 'migration_2026', content: 'm02_relance' },
  migration_m03_relance: { campaign: 'migration_2026', content: 'm03_relance' },
  migration_m04_relance: { campaign: 'migration_2026', content: 'm04_relance' },
  migration_m05_charte: { campaign: 'migration_2026', content: 'm05_charte' },
  // Charte qualité
  relance_signature_charte: { campaign: 'charte', content: 'relance_signature_charte' },
  notif_nouvelle_version_charte: { campaign: 'charte', content: 'nouvelle_version_charte' },
  suspension_charte_exemption_expiree: { campaign: 'charte', content: 'suspension_exemption_expiree' },
  // Fiche prestataire / modération
  notif_nouvelle_soumission_fiche: { campaign: 'moderation', content: 'nouvelle_soumission_fiche' },
  validation_publication_fiche: { campaign: 'moderation', content: 'validation_publication_fiche' },
  demande_reactivation: { campaign: 'moderation', content: 'demande_reactivation' },
  // Messagerie / demandes de devis
  notif_nouveau_contact_presta: { campaign: 'messagerie', content: 'nouveau_contact_presta' },
  notif_nouveau_contact_presta_sans_compte: { campaign: 'messagerie', content: 'nouveau_contact_presta_sans_compte' },
  notif_reponse_client_avec_compte: { campaign: 'messagerie', content: 'reponse_client_avec_compte' },
  notif_reponse_client_sans_compte: { campaign: 'messagerie', content: 'reponse_client_sans_compte' },
  notif_reponse_presta: { campaign: 'messagerie', content: 'reponse_presta' },
  // Abonnement / impayés
  impaye_premier_echec: { campaign: 'facturation', content: 'impaye_premier_echec' },
  impaye_rappel_intermediaire: { campaign: 'facturation', content: 'impaye_rappel_intermediaire' },
  impaye_suspension: { campaign: 'facturation', content: 'impaye_suspension' },
}

export function utmFor(templateName: string): { campaign: string; content: string } {
  return UTM_MAP[templateName] ?? { campaign: 'transactionnel', content: templateName }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

function isPublicSiteHost(hostname: string): boolean {
  const siteUrl = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://lesnoces.net'
  const siteHost = hostOf(siteUrl) ?? 'lesnoces.net'
  return hostname === siteHost || hostname === `www.${siteHost}`
}

// Adds utm_source / utm_medium / utm_campaign / utm_content to a URL.
// Returns the URL unchanged if it's not an http(s) link to the public site,
// or if it already carries any utm_* param (never overwrites).
export function addUtm(url: string, templateName: string): string {
  if (!/^https?:\/\//i.test(url)) return url
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }
  if (!isPublicSiteHost(parsed.hostname)) return url
  const hasUtm = [...parsed.searchParams.keys()].some((k) => k.toLowerCase().startsWith('utm_'))
  if (hasUtm) return url
  const { campaign, content } = utmFor(templateName)
  parsed.searchParams.set('utm_source', UTM_SOURCE)
  parsed.searchParams.set('utm_medium', UTM_MEDIUM)
  parsed.searchParams.set('utm_campaign', campaign)
  parsed.searchParams.set('utm_content', content)
  return parsed.toString()
}

// Rewrites every href in rendered email HTML. Only <a href> values are
// touched; src attributes and anything else are left alone. The unsubscribe
// footer is appended downstream by the sender, so it is never present here.
export function tagEmailLinks(html: string, templateName: string): string {
  return html.replace(/(<a\b[^>]*?\bhref=")([^"]*)(")/gi, (m, before, href, after) => {
    if (/^mailto:/i.test(href)) return m
    const tagged = addUtm(href, templateName)
    return tagged === href ? m : before + tagged + after
  })
}
