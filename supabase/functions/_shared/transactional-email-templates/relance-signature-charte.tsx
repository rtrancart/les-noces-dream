import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'LesNoces.net'
const LOGO_URL = 'https://egbohbwiywgyyculswvf.supabase.co/storage/v1/object/public/email-assets/logo-lesnoces.png'

interface Props {
  prenom?: string
  nom_commercial?: string
  magic_link?: string
  jours_restants?: number
}

const Email = ({ prenom, nom_commercial, magic_link, jours_restants }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Activez votre espace prestataire {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="160" height="48" style={logoImg} />
        </Section>
        <Heading style={h1}>Bonjour{prenom ? ` ${prenom}` : ''},</Heading>
        <Text style={text}>
          Votre fiche <strong>{nom_commercial ?? ''}</strong> est toujours en attente d'activation sur {SITE_NAME}.
          Pour la rendre visible, il vous suffit de signer la Charte Qualité depuis votre espace.
        </Text>
        {typeof jours_restants === 'number' && jours_restants > 0 && (
          <Text style={textHighlight}>
            Sans signature dans les <strong>{jours_restants} jours</strong>, votre fiche sera archivée.
          </Text>
        )}
        {magic_link && (
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={magic_link} style={button}>Signer la Charte maintenant</Button>
          </Section>
        )}
        <Text style={footer}>Ce lien expire dans 60 jours.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: `Activez votre espace prestataire ${SITE_NAME}`,
  displayName: 'Relance signature charte',
  previewData: { prenom: 'Marie', nom_commercial: 'Atelier Marie Fleurs', magic_link: 'https://lesnoces.net/accept-invitation', jours_restants: 14 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Montserrat, Arial, sans-serif' }
const container = { padding: '0 0 32px', maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#F5EFE3', padding: '28px', textAlign: 'center' as const, marginBottom: '32px' }
const logoImg = { display: 'block', margin: '0 auto', height: '48px', width: 'auto' }
const h1 = { fontFamily: 'Playfair Display, Georgia, serif', fontSize: '24px', fontWeight: 'normal', color: '#2C3E50', margin: '0 28px 16px' }
const text = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '0 28px 16px' }
const textHighlight = { fontSize: '15px', color: '#A57D27', lineHeight: '1.6', margin: '0 28px 16px', fontWeight: 'bold' as const }
const button = { backgroundColor: '#A57D27', color: '#ffffff', padding: '14px 32px', borderRadius: '2px', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' as const }
const footer = { fontSize: '12px', color: '#999', margin: '32px 28px 0', textAlign: 'center' as const }
