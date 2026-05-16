import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'LesNoces.net'
const LOGO_URL = 'https://egbohbwiywgyyculswvf.supabase.co/storage/v1/object/public/email-assets/logo-lesnoces.png'

interface Props {
  nom_commercial?: string
  email_prestataire?: string
  message?: string
  lien_backoffice?: string
}

const Email = ({ nom_commercial, email_prestataire, message, lien_backoffice }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Demande de réactivation prestataire — {nom_commercial ?? ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="160" height="48" style={logoImg} />
        </Section>
        <Heading style={h1}>Demande de réactivation</Heading>
        <Text style={text}>
          Le prestataire <strong>{nom_commercial ?? ''}</strong> ({email_prestataire ?? ''}) demande la réactivation de sa fiche archivée.
        </Text>
        {message && (
          <Section style={card}>
            <Text style={cardLabel}>Message</Text>
            <Text style={messageStyle}>{message}</Text>
          </Section>
        )}
        <Hr style={hr} />
        {lien_backoffice && (
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={lien_backoffice} style={button}>Ouvrir dans le back-office</Button>
          </Section>
        )}
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Demande de réactivation — ${d?.nom_commercial ?? 'prestataire archivé'}`,
  displayName: 'Demande réactivation (admin)',
  previewData: { nom_commercial: 'Atelier Marie Fleurs', email_prestataire: 'marie@example.com', message: 'Bonjour, je souhaite réactiver ma fiche.', lien_backoffice: 'https://lesnoces.net/admin/prestataires' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Montserrat, Arial, sans-serif' }
const container = { padding: '0 0 32px', maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#F5EFE3', padding: '28px', textAlign: 'center' as const, marginBottom: '32px' }
const logoImg = { display: 'block', margin: '0 auto', height: '48px', width: 'auto' }
const h1 = { fontFamily: 'Playfair Display, Georgia, serif', fontSize: '24px', fontWeight: 'normal', color: '#2C3E50', margin: '0 28px 16px' }
const text = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '0 28px 16px' }
const card = { backgroundColor: '#FAF7F1', padding: '20px', borderRadius: '4px', border: '1px solid #E8E0D0', margin: '0 28px' }
const cardLabel = { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#A57D27', margin: '0 0 8px', fontWeight: 'bold' as const }
const messageStyle = { fontSize: '14px', color: '#4A4A4A', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#E8E0D0', margin: '24px 28px' }
const button = { backgroundColor: '#A57D27', color: '#ffffff', padding: '12px 28px', borderRadius: '2px', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' as const }
