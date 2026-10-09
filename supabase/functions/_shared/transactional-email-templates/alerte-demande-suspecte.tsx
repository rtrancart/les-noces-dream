import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'LesNoces.net'
const LOGO_URL = 'https://egbohbwiywgyyculswvf.supabase.co/storage/v1/object/public/email-assets/logo-lesnoces.png'

interface Props {
  prestataireNom?: string
  contactNom?: string
  contactEmail?: string
  contactTelephone?: string
  lieuEvenement?: string
  nombreInvites?: string
  message?: string
  score?: number
  raisons?: string[]
  lien?: string
}

const Email = (p: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Demande de devis à vérifier pour {p.prestataireNom ?? 'un prestataire'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="160" height="48" style={logoImg} />
        </Section>
        <Heading style={h1}>Demande de devis à vérifier</Heading>
        <Text style={text}>
          Cette demande n'a pas été transmise au prestataire. Elle attend votre validation.
        </Text>
        <Text style={text}><strong>Prestataire :</strong> {p.prestataireNom ?? '—'}</Text>
        <Text style={text}>
          <strong>Contact :</strong> {p.contactNom ?? '—'} · {p.contactEmail ?? '—'} · {p.contactTelephone ?? 'sans téléphone'}
        </Text>
        {p.lieuEvenement && <Text style={text}><strong>Lieu :</strong> {p.lieuEvenement}</Text>}
        {p.nombreInvites && <Text style={text}><strong>Invités :</strong> {p.nombreInvites}</Text>}
        <Text style={alerte}>Score de suspicion : {p.score ?? 0}</Text>
        <Text style={mono}>{(p.raisons ?? []).map((r) => `• ${r}`).join('\n') || '—'}</Text>
        {p.message && <Text style={text}><strong>Message :</strong> {p.message}</Text>}
        {p.lien && (
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={p.lien} style={button}>Voir la demande</Button>
          </Section>
        )}
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `[À vérifier] Demande de devis pour ${data?.prestataireNom ?? 'un prestataire'}`,
  to: 'rodolphe@lesnoces.net',
  displayName: 'Alerte demande de devis suspecte (administration)',
  previewData: {
    prestataireNom: 'Studio Lumière',
    contactNom: 'Jean Test',
    contactEmail: 'jean@yopmail.com',
    contactTelephone: '+226 70 00 00 00',
    score: 5,
    raisons: ['Indicatif hors zone : +226', "Message d'un seul mot"],
    message: 'Bonjour',
    lien: 'https://lesnoces.net/admin/demandes?demande=xxx',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Montserrat, Arial, sans-serif' }
const container = { padding: '0 0 32px', maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#F5EFE3', padding: '28px', textAlign: 'center' as const, marginBottom: '32px' }
const logoImg = { display: 'block', margin: '0 auto', height: '48px', width: 'auto' }
const h1 = { fontFamily: 'Playfair Display, Georgia, serif', fontSize: '24px', fontWeight: 'normal', color: '#2C3E50', margin: '0 28px 16px' }
const alerte = { fontSize: '16px', fontWeight: 'bold', color: '#A57D27', lineHeight: '1.5', margin: '16px 28px 8px' }
const text = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '0 28px 12px' }
const mono = { fontFamily: 'Consolas, monospace', fontSize: '13px', color: '#2C3E50', backgroundColor: '#F7F5F0', padding: '12px 16px', margin: '0 28px 16px', lineHeight: '1.6', whiteSpace: 'pre-line' as const }
const button = { backgroundColor: '#A57D27', color: '#ffffff', padding: '14px 32px', borderRadius: '2px', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' as const }
