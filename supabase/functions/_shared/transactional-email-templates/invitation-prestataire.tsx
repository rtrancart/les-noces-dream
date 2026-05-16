import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'LesNoces.net'
const LOGO_URL = 'https://egbohbwiywgyyculswvf.supabase.co/storage/v1/object/public/email-assets/logo-lesnoces.png'

interface Props {
  prenom?: string
  nom_commercial?: string
  magic_link?: string
  expiration_heures?: number
}

const Email = ({ prenom, nom_commercial, magic_link, expiration_heures = 24 }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Bienvenue sur {SITE_NAME} — activez votre espace prestataire</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="160" height="48" style={logoImg} />
        </Section>
        <Heading style={h1}>Bienvenue{prenom ? ` ${prenom}` : ''} 🌿</Heading>
        <Text style={text}>
          Votre fiche <strong>{nom_commercial ?? 'prestataire'}</strong> a été pré-inscrite sur {SITE_NAME},
          le marketplace haut de gamme dédié au mariage.
        </Text>
        <Text style={text}>
          Cliquez ci-dessous pour activer votre espace, compléter votre fiche, et signer la Charte Qualité.
        </Text>
        {magic_link && (
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={magic_link} style={button}>Accéder à mon espace</Button>
          </Section>
        )}
        <Text style={footer}>
          Ce lien d'activation expire dans {expiration_heures} heures. Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: `Bienvenue sur ${SITE_NAME} — Activez votre espace prestataire`,
  displayName: 'Invitation prestataire (magic link)',
  previewData: { prenom: 'Marie', nom_commercial: 'Atelier Marie Fleurs', magic_link: 'https://lesnoces.net/accept-invitation', expiration_heures: 24 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Montserrat, Arial, sans-serif' }
const container = { padding: '0 0 32px', maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#F5EFE3', padding: '28px', textAlign: 'center' as const, marginBottom: '32px' }
const logoImg = { display: 'block', margin: '0 auto', height: '48px', width: 'auto' }
const h1 = { fontFamily: 'Playfair Display, Georgia, serif', fontSize: '26px', fontWeight: 'normal', color: '#2C3E50', margin: '0 28px 16px', lineHeight: '1.3' }
const text = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '0 28px 16px' }
const button = { backgroundColor: '#A57D27', color: '#ffffff', padding: '14px 32px', borderRadius: '2px', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' as const }
const footer = { fontSize: '12px', color: '#999', margin: '32px 28px 0', textAlign: 'center' as const }
