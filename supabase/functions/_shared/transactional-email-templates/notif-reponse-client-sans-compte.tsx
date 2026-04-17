import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Font, Head, Heading, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'LesNoces.net'
const LOGO_URL = 'https://egbohbwiywgyyculswvf.supabase.co/storage/v1/object/public/email-assets/logo-lesnoces.png'

interface Props {
  clientPrenom?: string
  prestataireNom?: string
  messageExtrait?: string
  lienMagique?: string
  lienInscription?: string
}

const Email = ({
  clientPrenom,
  prestataireNom,
  messageExtrait,
  lienMagique,
  lienInscription,
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head>
      <Font fontFamily="Playfair Display" fallbackFontFamily="Georgia" webFont={{ url: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.woff2', format: 'woff2' }} fontWeight={400} fontStyle="normal" />
      <Font fontFamily="Montserrat" fallbackFontFamily="Arial" webFont={{ url: 'https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXp-p7K4KLg.woff2', format: 'woff2' }} fontWeight={400} fontStyle="normal" />
    </Head>
    <Preview>{prestataireNom ?? 'Un prestataire'} vous a répondu sur {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="160" height="48" style={logoImg} />
        </Section>

        <Heading style={h1}>Vous avez un nouveau message</Heading>

        {messageExtrait && (
          <Section style={card}>
            <Text style={cardLabel}>{prestataireNom ?? 'Un prestataire'}</Text>
            <Text style={messageStyle}>{messageExtrait}</Text>
          </Section>
        )}

        <Text style={text}>
          Bonjour{clientPrenom ? ` ${clientPrenom}` : ''}, {prestataireNom ?? 'un prestataire'} vient de répondre à votre demande de devis.
        </Text>

        <Section style={ctaWrapper}>
          <Button href={lienMagique ?? '#'} style={button}>
            Lire et répondre
          </Button>
          <Text style={hint}>
            Lien sécurisé, valable 30 jours. Aucun mot de passe nécessaire.
          </Text>
        </Section>

        <Section style={separator}>
          <Text style={separatorText}>— OU —</Text>
        </Section>

        <Section style={signupCard}>
          <Text style={signupTitle}>Créez votre compte gratuit</Text>
          <Text style={signupText}>
            Pour retrouver tous vos échanges et organiser votre mariage en un seul endroit.
          </Text>
          <Button href={lienInscription ?? 'https://lesnoces.net/inscription'} style={buttonOutline}>
            Créer mon compte
          </Button>
        </Section>

        <Text style={footer}>
          Vous avez reçu cet email car vous avez contacté un prestataire via {SITE_NAME}.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `${d?.prestataireNom ?? 'Un prestataire'} vous a répondu`,
  displayName: 'Réponse prestataire (client sans compte)',
  previewData: {
    clientPrenom: 'Sophie',
    prestataireNom: 'Atelier Marie',
    messageExtrait: 'Bonjour Sophie, merci pour votre demande ! Je serais ravie de vous accompagner pour votre mariage...',
    lienMagique: 'https://lesnoces.net/messagerie/abc123token',
    lienInscription: 'https://lesnoces.net/inscription',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Montserrat, Arial, sans-serif' }
const container = { padding: '0 0 32px', maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#F5EFE3', padding: '28px', textAlign: 'center' as const, marginBottom: '32px' }
const logoImg = { display: 'block', margin: '0 auto', height: '48px', width: 'auto' }
const h1 = { fontFamily: 'Playfair Display, Georgia, "Times New Roman", serif', fontSize: '26px', fontWeight: 'normal', color: '#2C3E50', margin: '0 28px 16px', lineHeight: '1.3' }
const text = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '0 28px 16px', fontFamily: 'Montserrat, Arial, sans-serif' }
const card = { backgroundColor: '#FAF7F1', padding: '28px 24px', borderRadius: '6px', border: '1px solid #E8E0D0', margin: '0 28px 24px' }
const cardLabel = { fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#A57D27', margin: '0 0 12px', fontWeight: 'bold', fontFamily: 'Montserrat, Arial, sans-serif' }
const messageStyle = { fontSize: '17px', color: '#2C3E50', lineHeight: '1.6', margin: 0, fontFamily: 'Playfair Display, Georgia, serif', whiteSpace: 'pre-wrap' as const }
const ctaWrapper = { textAlign: 'center' as const, margin: '32px 28px' }
const button = { backgroundColor: '#A57D27', color: '#ffffff', padding: '12px 28px', borderRadius: '2px', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontFamily: 'Montserrat, Arial, sans-serif' }
const buttonOutline = { backgroundColor: 'transparent', color: '#A57D27', padding: '10px 24px', borderRadius: '2px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' as const, border: '1px solid #A57D27', fontFamily: 'Montserrat, Arial, sans-serif' }
const hint = { fontSize: '12px', color: '#999', margin: '12px 0 0', fontFamily: 'Montserrat, Arial, sans-serif' }
const separator = { textAlign: 'center' as const, margin: '24px 0' }
const separatorText = { fontSize: '11px', color: '#A57D27', letterSpacing: '0.15em', margin: 0, fontFamily: 'Montserrat, Arial, sans-serif' }
const signupCard = { textAlign: 'center' as const, padding: '24px', backgroundColor: '#FAF7F1', borderRadius: '4px', margin: '0 28px 24px' }
const signupTitle = { fontFamily: 'Playfair Display, Georgia, serif', fontSize: '18px', color: '#2C3E50', fontWeight: 'normal', margin: '0 0 8px' }
const signupText = { fontSize: '13px', color: '#666', margin: '0 0 16px', lineHeight: '1.5', fontFamily: 'Montserrat, Arial, sans-serif' }
const footer = { fontSize: '12px', color: '#999', margin: '32px 28px 0', textAlign: 'center' as const, fontFamily: 'Montserrat, Arial, sans-serif' }
