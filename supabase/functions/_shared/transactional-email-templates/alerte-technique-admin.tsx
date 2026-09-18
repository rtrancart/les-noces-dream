import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'LesNoces.net'
const LOGO_URL = 'https://egbohbwiywgyyculswvf.supabase.co/storage/v1/object/public/email-assets/logo-lesnoces.png'

interface Props {
  /** Titre court du symptôme détecté. */
  symptome?: string
  /** Explication en clair de ce qui est bloqué et de l'impact. */
  explication?: string
  /** Détail chiffré (nombre d'éléments, durée, heure de première détection). */
  detail?: string
  /** Lien vers la page d'administration utile au diagnostic. */
  lien?: string
}

const Email = ({ symptome, explication, detail, lien }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>{symptome ?? 'Alerte technique'} — action requise</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="160" height="48" style={logoImg} />
        </Section>
        <Heading style={h1}>Alerte technique</Heading>
        <Text style={alerte}>{symptome ?? 'Un traitement automatique est bloqué'}</Text>
        {explication && <Text style={text}>{explication}</Text>}
        {detail && <Text style={mono}>{detail}</Text>}
        {lien && (
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={lien} style={button}>Ouvrir le back-office</Button>
          </Section>
        )}
        <Text style={footer}>
          Surveillance automatique horaire. Une seule alerte est envoyée par symptôme toutes les 24 heures.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `[Alerte] ${data?.symptome ?? 'Traitement automatique bloqué'} — ${SITE_NAME}`,
  to: 'rodolphe@lesnoces.net',
  displayName: 'Alerte technique (administration)',
  previewData: {
    symptome: 'Appels internes refusés (401)',
    explication:
      "Des tâches planifiées se font refuser l'accès au serveur. Les emails automatiques et les synchronisations peuvent être interrompus.",
    detail: '12 appels refusés depuis 09:15 (heure de Paris).',
    lien: 'https://lesnoces.net/admin/emails-suivi',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Montserrat, Arial, sans-serif' }
const container = { padding: '0 0 32px', maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#F5EFE3', padding: '28px', textAlign: 'center' as const, marginBottom: '32px' }
const logoImg = { display: 'block', margin: '0 auto', height: '48px', width: 'auto' }
const h1 = { fontFamily: 'Playfair Display, Georgia, serif', fontSize: '24px', fontWeight: 'normal', color: '#2C3E50', margin: '0 28px 16px' }
const alerte = { fontSize: '16px', fontWeight: 'bold', color: '#A57D27', lineHeight: '1.5', margin: '0 28px 16px' }
const text = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '0 28px 16px' }
const mono = { fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: '13px', color: '#2C3E50', backgroundColor: '#F7F5F0', padding: '12px 16px', margin: '0 28px 16px', lineHeight: '1.6' }
const button = { backgroundColor: '#A57D27', color: '#ffffff', padding: '14px 32px', borderRadius: '2px', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' as const }
const footer = { fontSize: '12px', color: '#999', margin: '32px 28px 0', textAlign: 'center' as const }
