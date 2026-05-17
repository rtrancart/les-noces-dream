import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'LesNoces.net'
const LOGO_URL = 'https://egbohbwiywgyyculswvf.supabase.co/storage/v1/object/public/email-assets/logo-lesnoces.png'

interface Props {
  prenom?: string
  nom_commercial?: string
  lien_fiche_publique?: string
  lien_dashboard?: string
}

const Email = ({ prenom, nom_commercial, lien_fiche_publique, lien_dashboard }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre fiche est publiée sur {SITE_NAME} 🎉</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="160" height="48" style={logoImg} />
        </Section>
        <Heading style={h1}>Félicitations{prenom ? ` ${prenom}` : ''} 🎉</Heading>
        <Text style={text}>
          Votre fiche <strong>{nom_commercial ?? ''}</strong> vient d'être validée par notre équipe et est désormais visible
          par les couples sur {SITE_NAME}.
        </Text>
        <Text style={text}>
          Pensez à soigner vos premières demandes, votre temps de réponse impacte directement votre visibilité.
        </Text>
        {lien_fiche_publique && (
          <Section style={{ textAlign: 'center', margin: '24px 0 12px' }}>
            <Button href={lien_fiche_publique} style={button}>Voir ma fiche publique</Button>
          </Section>
        )}
        {lien_dashboard && (
          <Section style={{ textAlign: 'center', margin: '0 0 24px' }}>
            <Button href={lien_dashboard} style={buttonSecondary}>Accéder à mon espace</Button>
          </Section>
        )}
        <Text style={footer}>L'équipe éditoriale de {SITE_NAME}.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: `Votre fiche est publiée sur ${SITE_NAME}`,
  displayName: 'Validation et publication de fiche',
  previewData: { prenom: 'Marie', nom_commercial: 'Atelier Marie Fleurs', lien_fiche_publique: 'https://lesnoces.net/prestataires/atelier-marie', lien_dashboard: 'https://lesnoces.net/espace-pro' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Montserrat, Arial, sans-serif' }
const container = { padding: '0 0 32px', maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#F5EFE3', padding: '28px', textAlign: 'center' as const, marginBottom: '32px' }
const logoImg = { display: 'block', margin: '0 auto', height: '48px', width: 'auto' }
const h1 = { fontFamily: 'Playfair Display, Georgia, serif', fontSize: '26px', fontWeight: 'normal', color: '#2C3E50', margin: '0 28px 16px', lineHeight: '1.3' }
const text = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '0 28px 16px' }
const button = { backgroundColor: '#A57D27', color: '#ffffff', padding: '14px 32px', borderRadius: '2px', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' as const }
const buttonSecondary = { backgroundColor: '#2C3E50', color: '#ffffff', padding: '12px 28px', borderRadius: '2px', fontSize: '12px', fontWeight: 'normal', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' as const }
const footer = { fontSize: '12px', color: '#999', margin: '32px 28px 0', textAlign: 'center' as const }
