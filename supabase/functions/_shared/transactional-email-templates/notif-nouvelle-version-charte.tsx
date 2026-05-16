import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'LesNoces.net'
const LOGO_URL = 'https://egbohbwiywgyyculswvf.supabase.co/storage/v1/object/public/email-assets/logo-lesnoces.png'

interface Props {
  prenom?: string
  nom_commercial?: string
  numero_version?: string
  magic_link?: string
}

const Email = ({ prenom, nom_commercial, numero_version, magic_link }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Nouvelle version de la Charte Qualité {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="160" height="48" style={logoImg} />
        </Section>
        <Heading style={h1}>Nouvelle version de la Charte Qualité</Heading>
        <Text style={text}>Bonjour{prenom ? ` ${prenom}` : ''},</Text>
        <Text style={text}>
          La Charte Qualité {SITE_NAME} a été mise à jour {numero_version ? `(version ${numero_version})` : ''}.
          Pour que la fiche <strong>{nom_commercial ?? ''}</strong> reste publiée, il vous faut signer cette nouvelle version sous <strong>15 jours</strong>.
        </Text>
        {magic_link && (
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={magic_link} style={button}>Lire et signer la nouvelle Charte</Button>
          </Section>
        )}
        <Text style={footer}>Passé ce délai, votre fiche sera temporairement suspendue jusqu'à signature.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: `Nouvelle version de la Charte Qualité ${SITE_NAME}`,
  displayName: 'Notif nouvelle version charte',
  previewData: { prenom: 'Marie', nom_commercial: 'Atelier Marie Fleurs', numero_version: 'v2', magic_link: 'https://lesnoces.net/espace-pro/charte' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Montserrat, Arial, sans-serif' }
const container = { padding: '0 0 32px', maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#F5EFE3', padding: '28px', textAlign: 'center' as const, marginBottom: '32px' }
const logoImg = { display: 'block', margin: '0 auto', height: '48px', width: 'auto' }
const h1 = { fontFamily: 'Playfair Display, Georgia, serif', fontSize: '24px', fontWeight: 'normal', color: '#2C3E50', margin: '0 28px 16px' }
const text = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '0 28px 16px' }
const button = { backgroundColor: '#A57D27', color: '#ffffff', padding: '14px 32px', borderRadius: '2px', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' as const }
const footer = { fontSize: '12px', color: '#999', margin: '32px 28px 0', textAlign: 'center' as const }
