// Moteur de rendu HTML email-safe pour les templates transactionnels LesNoces.
// Produit un HTML basé sur des <table>, styles inline, largeur 600 px, compatible Outlook.
// Utilisé uniquement au moment du seed en base (email_textes), pas au runtime.

import { BRAND_ASSETS } from '../_shared/transactional-email-templates/brand-assets.ts'

// -------------------- Palette & typos --------------------
const C = {
  or: '#A57D27',
  champagne: '#C9AF78',
  champagneLight: '#FBF3E1',
  petrole: '#2D4356',
  abysse: '#0F141E',
  ink: '#0F141E',
  paper: '#FFFFFF',
  cream: '#FAF7F1',
  border: '#E8E0D0',
  muted: '#7A7A7A',
  text: '#4A4A4A',
}
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif"
const SANS = "Montserrat, Arial, sans-serif"

// -------------------- Primitives --------------------
type Block =
  | { t: 'eyebrow'; text: string }
  | { t: 'h'; text: string }
  | { t: 'p'; text: string }
  | { t: 'small'; text: string }
  | { t: 'note'; text: string }
  | { t: 'warn'; text: string }
  | { t: 'quote'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'ol'; items: [string, string?][] }
  | { t: 'checks'; items: [string, string][] }
  | { t: 'info'; rows: [string, string][] }
  | { t: 'stats'; items: [string, string][] }
  | { t: 'btn'; label: string; href: string }
  | { t: 'ghost'; label: string; href: string }
  | { t: 'hr' }
  | { t: 'italic'; text: string }

function eyebrow(text: string) {
  return `<p style="margin:0 0 12px;font-family:${SANS};font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${C.or};font-weight:600">${text}</p>`
}
function h(text: string) {
  return `<h1 style="margin:0 0 20px;font-family:${SERIF};font-weight:500;font-size:28px;line-height:1.2;color:${C.abysse}">${text}</h1>`
}
function p(text: string) {
  return `<p style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.text}">${text}</p>`
}
function small(text: string) {
  return `<p style="margin:16px 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted}">${text}</p>`
}
function note(text: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td style="background:${C.cream};border-left:3px solid ${C.or};padding:14px 18px;font-family:${SANS};font-size:14px;line-height:1.6;color:${C.text}">${text}</td></tr></table>`
}
function warn(text: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td style="background:#FDF4E7;border-left:3px solid #B4741F;padding:14px 18px;font-family:${SANS};font-size:14px;line-height:1.6;color:#5C4318">${text}</td></tr></table>`
}
function quote(text: string) {
  return `<p style="margin:0 0 20px;font-family:${SERIF};font-style:italic;font-size:17px;line-height:1.5;color:${C.petrole};text-align:center">« ${text} »</p>`
}
function ul(items: string[]) {
  const lis = items.map(i => `<li style="margin:0 0 8px;padding-left:6px">${i}</li>`).join('')
  return `<ul style="margin:0 0 20px 22px;padding:0;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.text}">${lis}</ul>`
}
function ol(items: [string, string?][]) {
  const lis = items.map(([a, b]) => `<li style="margin:0 0 10px;padding-left:6px"><b style="color:${C.abysse}">${a}</b>${b ? ` — ${b}` : ''}</li>`).join('')
  return `<ol style="margin:0 0 20px 22px;padding:0;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.text}">${lis}</ol>`
}
function info(rows: [string, string][]) {
  const trs = rows.map(([k, v]) => `<tr><td style="padding:10px 0;border-bottom:1px solid ${C.border};font-family:${SANS};font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:${C.or};font-weight:600;width:42%">${k}</td><td style="padding:10px 0;border-bottom:1px solid ${C.border};font-family:${SANS};font-size:15px;color:${C.abysse}">${v}</td></tr>`).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};margin:0 0 20px"><tr><td style="padding:8px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${trs}</table></td></tr></table>`
}
function stats(items: [string, string][]) {
  const w = Math.floor(100 / items.length)
  const tds = items.map(([v, l]) => `<td align="center" width="${w}%" style="padding:16px 8px;font-family:${SANS}"><div style="font-family:${SERIF};font-size:32px;color:${C.or};line-height:1">${v}</div><div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:${C.muted};margin-top:6px">${l}</div></td>`).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};margin:0 0 20px"><tr>${tds}</tr></table>`
}
function btn(label: string, href: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px"><tr><td align="center" style="border-radius:2px" bgcolor="${C.or}"><a href="${href}" style="display:inline-block;padding:14px 32px;font-family:${SANS};font-size:13px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#FFFFFF;text-decoration:none;border-radius:2px">${label}</a></td></tr></table>`
}
function ghost(label: string, href: string) {
  return `<div style="margin:0 0 20px"><a href="${href}" style="display:inline-block;padding:12px 26px;font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:${C.petrole};text-decoration:none;border:1px solid ${C.petrole};border-radius:2px">${label}</a></div>`
}

function checks(items: [string, string][]) {
  const rows = items.map(([label, desc]) => `<tr><td valign="top" width="22" style="padding:0 10px 12px 0;font-family:${SANS};font-size:15px;color:${C.or};font-weight:700;line-height:1.5">✓</td><td style="padding:0 0 12px;font-family:${SANS};font-size:14.5px;line-height:1.6;color:${C.text}"><b style="color:${C.abysse}">${label}</b> — ${desc}</td></tr>`).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px">${rows}</table>`
}
function hr() {
  return `<hr style="border:0;border-top:1px solid ${C.border};margin:28px 0 20px" />`
}
function italic(text: string) {
  return `<p style="margin:20px 0 0;font-family:${SERIF};font-style:italic;font-size:14px;line-height:1.6;color:${C.muted}">${text}</p>`
}

function renderBlock(b: Block): string {
  switch (b.t) {
    case 'eyebrow': return eyebrow(b.text)
    case 'h': return h(b.text)
    case 'p': return p(b.text)
    case 'small': return small(b.text)
    case 'note': return note(b.text)
    case 'warn': return warn(b.text)
    case 'quote': return quote(b.text)
    case 'ul': return ul(b.items)
    case 'ol': return ol(b.items)
    case 'checks': return checks(b.items)
    case 'info': return info(b.rows)
    case 'stats': return stats(b.items)
    case 'btn': return btn(b.label, b.href)
    case 'ghost': return ghost(b.label, b.href)
    case 'hr': return hr()
    case 'italic': return italic(b.text)
  }
}

// -------------------- Composer --------------------
// La coquille (header + footer + signature) est désormais gérée à l'envoi
// par `_shared/email-shell.ts`. Ici on ne produit que le CORPS du template,
// ce qui permet de partager un header/pied de page communs à tous les emails.
type Signer = 'nathalie' | 'equipe' | 'none'

function compose(_preview: string, blocks: Block[], _signer: Signer) {
  return blocks.map(renderBlock).join('')
}

// -------------------- Definitions (11 templates) --------------------

export interface DesignedTemplate {
  subject: string
  html: string // corps uniquement (sera enveloppé par la coquille commune)
}

export const DESIGNED_TEMPLATES: Record<string, DesignedTemplate> = {



  // A-01
  invitation_prestataire: {
    subject: 'LesNoces.net vous a sélectionné pour rejoindre notre marketplace',
    html: compose(
      'Votre fiche a été créée — il ne reste qu\'à la revendiquer',
      [
        { t: 'eyebrow', text: 'Sélection LesNoces' },
        { t: 'h', text: 'Votre établissement a retenu notre attention' },
        { t: 'p', text: 'Bonjour {{prenom}}, en préparant nos prochaines mises en avant, nous avons étudié de nombreux professionnels de votre secteur — et <b>{{nom_commercial}}</b> fait partie de ceux que nous avons choisi de sélectionner.' },
        { t: 'p', text: 'LesNoces n\'est pas un annuaire ouvert : chaque professionnel est sélectionné manuellement pour la qualité de ses prestations, sa réputation et son positionnement haut de gamme.' },
        { t: 'note', text: '🎉 Votre fiche est déjà créée. Avant sa publication, deux étapes : la compléter et signer la charte qualité. Ensuite, 90 jours entièrement gratuits.' },
        { t: 'btn', label: 'Revendiquer ma fiche', href: '{{magic_link}}' },
        { t: 'small', text: 'Ce lien est valable {{expiration_heures}} heures. Passé ce délai, contactez-nous pour en recevoir un nouveau.' },
      ],
      'nathalie'
    ),
  },

  // Design system appliqué (pas de maquette dédiée)
  relance_signature_charte: {
    subject: 'Il reste {{jours_restants}} jours pour signer la charte qualité',
    html: compose(
      'Votre fiche vous attend — quelques minutes suffisent',
      [
        { t: 'eyebrow', text: 'Rappel signature' },
        { t: 'h', text: 'Votre fiche est prête à être publiée' },
        { t: 'p', text: 'Bonjour {{prenom}}, la fiche <b>{{nom_commercial}}</b> est bien enregistrée. Il ne manque plus que votre signature de la charte qualité pour la mettre en ligne.' },
        { t: 'note', text: '⏳ Il vous reste <b>{{jours_restants}} jours</b> pour finaliser la signature. Au-delà, la fiche sera archivée.' },
        { t: 'btn', label: 'Signer la charte', href: '{{magic_link}}' },
        { t: 'p', text: 'La signature prend moins de 2 minutes. Vous conservez ensuite 90 jours de visibilité gratuits.' },
      ],
      'nathalie'
    ),
  },

  // Design system appliqué (interne équipe)
  notif_nouvelle_soumission_fiche: {
    subject: 'Nouvelle fiche à examiner : {{nom_commercial}}',
    html: compose(
      'Un prestataire vient de soumettre sa fiche pour validation',
      [
        { t: 'eyebrow', text: 'Nouveau dossier' },
        { t: 'h', text: 'Fiche soumise pour validation' },
        { t: 'p', text: 'Le prestataire <b>{{nom_commercial}}</b> vient de soumettre sa fiche. Elle est en attente d\'examen dans le back-office.' },
        { t: 'info', rows: [
          ["Nom commercial", '{{nom_commercial}}'],
          ["Catégorie", '{{categorie}}'],
          ["Ville", '{{ville}}'],
        ]},
        { t: 'btn', label: 'Ouvrir le back-office', href: '{{lien_back_office}}' },
      ],
      'none'
    ),
  },

  // P-07
  validation_publication_fiche: {
    subject: 'Votre fiche {{nom_commercial}} est en ligne sur LesNoces !',
    html: compose(
      'Votre période découverte commence aujourd\'hui',
      [
        { t: 'eyebrow', text: 'Félicitations' },
        { t: 'h', text: 'Votre fiche est en ligne' },
        { t: 'p', text: 'Excellente nouvelle {{prenom}} ! Après validation, votre fiche <b>{{nom_commercial}}</b> est publiée et visible par nos futurs mariés.' },
        { t: 'p', text: '<b>3 actions pour maximiser vos résultats :</b>' },
        { t: 'ul', items: [
          'Répondez aux demandes sous 24h',
          'Complétez vos tags et spécialités',
          'Précisez vos zones d\'intervention',
        ]},
        { t: 'btn', label: 'Voir ma fiche en ligne', href: '{{lien_fiche_publique}}' },
        { t: 'ghost', label: 'Accéder à mon tableau de bord', href: '{{lien_dashboard}}' },
      ],
      'nathalie'
    ),
  },

  // Design system appliqué (charte v2)
  notif_nouvelle_version_charte: {
    subject: 'Une nouvelle version de la charte qualité est disponible',
    html: compose(
      'Version {{numero_version}} — merci de la relire et signer',
      [
        { t: 'eyebrow', text: 'Charte qualité' },
        { t: 'h', text: 'Nouvelle version de la charte' },
        { t: 'p', text: 'Bonjour {{prenom}}, une nouvelle version de la charte qualité LesNoces vient d\'être publiée (<b>{{numero_version}}</b>).' },
        { t: 'p', text: 'Pour maintenir la visibilité de <b>{{nom_commercial}}</b>, merci de relire les évolutions et de signer cette nouvelle version.' },
        { t: 'note', text: 'La signature prend moins de 2 minutes et ne modifie ni votre fiche ni votre abonnement.' },
        { t: 'btn', label: 'Relire et signer', href: '{{magic_link}}' },
      ],
      'equipe'
    ),
  },

  // C-07 (côté marié)
  notif_reponse_client_avec_compte: {
    subject: '{{prestataireNom}} vous a répondu',
    html: compose(
      'Lisez et répondez depuis votre messagerie',
      [
        { t: 'eyebrow', text: 'Nouvelle réponse' },
        { t: 'h', text: '{{prestataireNom}} vous a répondu' },
        { t: 'p', text: 'Bonjour {{clientPrenom}}, vous avez reçu une réponse à votre demande. Retrouvez le message complet dans votre messagerie.' },
        { t: 'note', text: '« {{messageExtrait}} »' },
        { t: 'btn', label: 'Répondre à {{prestataireNom}}', href: '{{lienMessagerie}}' },
        { t: 'small', text: 'La conversation reste sur la plateforme pour votre confort et votre sécurité.' },
      ],
      'none'
    ),
  },

  // C-07 variante magic link
  notif_reponse_client_sans_compte: {
    subject: '{{prestataireNom}} vous a répondu',
    html: compose(
      'Accédez à votre conversation en un clic',
      [
        { t: 'eyebrow', text: 'Nouvelle réponse' },
        { t: 'h', text: '{{prestataireNom}} vous a répondu' },
        { t: 'p', text: 'Bonjour {{clientPrenom}}, vous avez reçu une réponse à votre demande. Voici un extrait :' },
        { t: 'note', text: '« {{messageExtrait}} »' },
        { t: 'btn', label: 'Lire et répondre', href: '{{lienMagique}}' },
        { t: 'p', text: 'Vous pouvez aussi créer un espace personnel pour retrouver toutes vos conversations, vos favoris et votre planificateur de mariage.' },
        { t: 'ghost', label: 'Créer mon espace mariés', href: '{{lienInscription}}' },
        { t: 'small', text: 'Connexion automatique via lien sécurisé, valable 7 jours.' },
      ],
      'none'
    ),
  },

  // Miroir de C-07 côté prestataire
  notif_reponse_presta: {
    subject: '{{clientNom}} vous a répondu',
    html: compose(
      'Nouvelle réponse dans votre messagerie',
      [
        { t: 'eyebrow', text: 'Nouvelle réponse' },
        { t: 'h', text: '{{clientNom}} vous a répondu' },
        { t: 'p', text: 'Bonjour {{prestataireNom}}, un client vient de vous répondre. Voici un extrait :' },
        { t: 'note', text: '« {{messageExtrait}} »' },
        { t: 'btn', label: 'Répondre dans ma messagerie', href: '{{lienMessagerie}}' },
        { t: 'small', text: 'Répondre sous 24h préserve votre taux de réponse et augmente vos chances de conversion.' },
      ],
      'none'
    ),
  },

  // Design system appliqué (interne)
  demande_reactivation: {
    subject: 'Demande de réactivation : {{nom_commercial}}',
    html: compose(
      'Un prestataire archivé souhaite réactiver sa fiche',
      [
        { t: 'eyebrow', text: 'Demande de réactivation' },
        { t: 'h', text: 'Réactivation demandée' },
        { t: 'p', text: 'Le prestataire <b>{{nom_commercial}}</b> ({{email_prestataire}}) souhaite réactiver sa fiche.' },
        { t: 'info', rows: [
          ['Prestataire', '{{nom_commercial}}'],
          ['Email', '{{email_prestataire}}'],
          ['Identifiant', '{{prestataire_id}}'],
        ]},
        { t: 'btn', label: 'Traiter dans le back-office', href: '{{lien_backoffice}}' },
      ],
      'none'
    ),
  },

  // P-14
  notif_nouveau_contact_presta: {
    subject: 'Nouvelle demande de devis via LesNoces.net',
    html: compose(
      'Répondez sous 24h pour maximiser vos chances',
      [
        { t: 'eyebrow', text: 'Nouvelle demande' },
        { t: 'h', text: '{{clientPrenom}} souhaite vous contacter' },
        { t: 'p', text: 'Bonjour {{prestataireNom}}, vous venez de recevoir une nouvelle demande de devis via LesNoces.net.' },
        { t: 'info', rows: [
          ['Prénom du client', '{{clientPrenom}}'],
          ['Catégorie', '{{categorie}}'],
          ['Type d\'événement', '{{objet}}'],
          ["Date de l'événement", '{{dateEvenement}}'],
          ["Lieu envisagé", '{{lieuEvenement}}'],
        ]},
        { t: 'note', text: '« {{message}} »' },
        { t: 'p', text: 'Pour préserver la qualité des échanges, les coordonnées du client ne sont pas communiquées à ce stade. Répondez directement depuis votre messagerie.' },
        { t: 'btn', label: 'Répondre dans ma messagerie', href: '{{lienConversation}}' },
        { t: 'small', text: 'Répondre sous 24h augmente vos chances et préserve votre taux de réponse (seuil 70 %).' },
      ],
      'equipe'
    ),
  },

  // P-15
  notif_nouveau_contact_presta_sans_compte: {
    subject: 'Nouvelle demande de devis (client sans compte)',
    html: compose(
      'Le client n\'a pas de compte LesNoces',
      [
        { t: 'eyebrow', text: 'Nouvelle demande — client sans compte' },
        { t: 'h', text: '{{clientPrenom}} souhaite vous contacter' },
        { t: 'p', text: 'Bonjour {{prestataireNom}}, vous venez de recevoir une nouvelle demande de devis.' },
        { t: 'info', rows: [
          ['Prénom du client', '{{clientPrenom}}'],
          ['Catégorie', '{{categorie}}'],
          ['Type d\'événement', '{{objet}}'],
          ["Date de l'événement", '{{dateEvenement}}'],
          ["Lieu envisagé", '{{lieuEvenement}}'],
        ]},
        { t: 'note', text: '« {{message}} »' },
        { t: 'warn', text: 'Ce client n\'a pas de compte LesNoces. Répondez depuis votre messagerie — votre réponse lui sera transmise par email.' },
        { t: 'btn', label: 'Répondre à cette demande', href: '{{lienConversation}}' },
      ],
      'equipe'
    ),
  },
}
