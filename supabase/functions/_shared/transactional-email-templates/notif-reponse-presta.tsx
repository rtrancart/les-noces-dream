import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Font, Head, Heading, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'LesNoces.net'
const LOGO_URL = 'https://egbohbwiywgyyculswvf.supabase.co/storage/v1/object/public/email-assets/logo-lesnoces.png'

interface Props {
  prestataireNom?: string
  clientNom?: string
  messageExtrait?: string
  lienMessagerie?: string
}

const Email = ({
  prestataireNom,
  clientNom,
  messageExtrait,
  lienMessagerie,
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head>
      <Font fontFamily="Playfair Display" fallbackFontFamily="Georgia" webFont={{ url: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.woff2', format: 'woff2' }} fontWeight={400} fontStyle="normal" />
      <Font fontFamily="Montserrat" fallbackFontFamily="Arial" webFont={{ url: 'https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXp-p7K4KLg.woff2', format: 'woff2' }} fontWeight={400} fontStyle="normal" />
    </Head>
    <Preview>{clientNom ?? 'Un client'} vous a répondu sur {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="160" height="48" style={logoImg} />
        </Section>

        <Heading style={h1}>Vous avez un nouveau message</Heading>

        {messageExtrait && (
          <Section style={card}>
            <Text style={cardLabel}>{clientNom ?? 'Un client'}</Text>
            <Text style={messageStyle}>{messageExtrait}</Text>
          </Section>
        )}

        <Text style={text}>
          Bonjour{prestataireNom ? ` ${prestataireNom}` : ''}, {clientNom ?? 'un client'} vient de vous répondre dans la messagerie.
        </Text>

        <Section style={ctaWrapper}>
          <Button href={lienMessagerie ?? 'https://lesnoces.net/espace-pro/demandes'} style={button}>
            Répondre
          </Button>
        </Section>

        <Text style={footer}>
          Une réponse rapide augmente significativement vos chances de conversion.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Nouveau message de ${d?.clientNom ?? 'votre client'}`,
  displayName: 'Réponse client (prestataire)',
  previewData: {
    prestataireNom: 'Atelier Marie',
    clientNom: 'Sophie Durand',
    messageExtrait: 'Merci beaucoup pour votre proposition ! Pourriez-vous me confirmer la disponibilité pour le 15 juin ?',
    lienMessagerie: 'https://lesnoces.net/espace-pro/demandes',
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
const footer = { fontSize: '12px', color: '#999', margin: '32px 28px 0', textAlign: 'center' as const, fontFamily: 'Montserrat, Arial, sans-serif' }
