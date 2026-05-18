import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'LesNoces.net'
const LOGO_URL = 'https://egbohbwiywgyyculswvf.supabase.co/storage/v1/object/public/email-assets/logo-lesnoces.png'

interface Props {
  nom_commercial?: string
  email_prestataire?: string
  prestataire_id?: string
  lien_backoffice?: string
}

const Email = ({ nom_commercial, email_prestataire, prestataire_id, lien_backoffice }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>[Réactivation] {nom_commercial ?? 'Prestataire'} demande la republication</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="160" height="48" style={logoImg} />
        </Section>
        <Heading style={h1}>Demande de réactivation</Heading>
        <Text style={text}>
          Un prestataire archivé (charte non signée dans le délai de 60 jours) demande la réactivation et la republication de son profil.
        </Text>
        <Section style={card}>
          <Text style={cardLabel}>Prestataire</Text>
          <Text style={messageStyle}><strong>{nom_commercial ?? '—'}</strong></Text>
          <Text style={messageStyle}>Email : {email_prestataire ?? '—'}</Text>
          <Text style={messageStyle}>ID : {prestataire_id ?? '—'}</Text>
        </Section>
        <Hr style={hr} />
        {lien_backoffice && (
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={lien_backoffice} style={button}>Ouvrir dans le back-office</Button>
          </Section>
        )}
        <Text style={footer}>
          Cette demande doit être validée manuellement par l'équipe {SITE_NAME}.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `[Réactivation] ${d?.nom_commercial ?? 'Prestataire archivé'} demande la republication`,
  displayName: 'Demande réactivation (équipe)',
  previewData: {
    nom_commercial: 'Atelier Marie Fleurs',
    email_prestataire: 'marie@example.com',
    prestataire_id: '00000000-0000-0000-0000-000000000000',
    lien_backoffice: 'https://lesnoces.net/admin/prestataires',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Montserrat, Arial, sans-serif' }
const container = { padding: '0 0 32px', maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#F5EFE3', padding: '28px', textAlign: 'center' as const, marginBottom: '32px' }
const logoImg = { display: 'block', margin: '0 auto', height: '48px', width: 'auto' }
const h1 = { fontFamily: 'Playfair Display, Georgia, serif', fontSize: '24px', fontWeight: 'normal', color: '#2C3E50', margin: '0 28px 16px' }
const text = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '0 28px 16px' }
const card = { backgroundColor: '#FAF7F1', padding: '20px', borderRadius: '4px', border: '1px solid #E8E0D0', margin: '0 28px' }
const cardLabel = { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#A57D27', margin: '0 0 8px', fontWeight: 'bold' as const }
const messageStyle = { fontSize: '14px', color: '#4A4A4A', lineHeight: '1.6', margin: '0 0 4px' }
const hr = { borderColor: '#E8E0D0', margin: '24px 28px' }
const button = { backgroundColor: '#A57D27', color: '#ffffff', padding: '12px 28px', borderRadius: '2px', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' as const }
const footer = { fontSize: '12px', color: '#999999', lineHeight: '1.5', margin: '24px 28px 0', fontStyle: 'italic' as const }
