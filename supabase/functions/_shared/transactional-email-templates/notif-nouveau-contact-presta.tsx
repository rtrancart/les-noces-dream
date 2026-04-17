import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Font, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'LesNoces.net'
const LOGO_URL = 'https://egbohbwiywgyyculswvf.supabase.co/storage/v1/object/public/email-assets/logo-lesnoces.png'

interface Props {
  prestataireNom?: string
  clientNom?: string
  clientEmail?: string
  clientTelephone?: string
  objet?: string
  message?: string
  dateEvenement?: string
  lieuEvenement?: string
  lienDemande?: string
}

const Email = ({
  prestataireNom,
  clientNom,
  clientEmail,
  clientTelephone,
  objet,
  message,
  dateEvenement,
  lieuEvenement,
  lienDemande,
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head>
      <Font fontFamily="Playfair Display" fallbackFontFamily="Georgia" webFont={{ url: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.woff2', format: 'woff2' }} fontWeight={400} fontStyle="normal" />
      <Font fontFamily="Montserrat" fallbackFontFamily="Arial" webFont={{ url: 'https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXp-p7K4KLg.woff2', format: 'woff2' }} fontWeight={400} fontStyle="normal" />
    </Head>
    <Preview>Nouvelle demande de devis sur {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="160" height="48" style={logoImg} />
        </Section>

        <Heading style={h1}>Nouvelle demande de devis</Heading>
        <Text style={text}>
          Bonjour{prestataireNom ? ` ${prestataireNom}` : ''}, vous avez reçu une nouvelle demande de devis via votre fiche {SITE_NAME}.
        </Text>

        <Section style={card}>
          <Text style={cardLabel}>Client</Text>
          <Text style={cardValue}>{clientNom ?? '—'}</Text>

          {clientEmail && (
            <>
              <Text style={cardLabel}>Email</Text>
              <Text style={cardValue}>{clientEmail}</Text>
            </>
          )}

          {clientTelephone && (
            <>
              <Text style={cardLabel}>Téléphone</Text>
              <Text style={cardValue}>{clientTelephone}</Text>
            </>
          )}

          {objet && (
            <>
              <Text style={cardLabel}>Objet</Text>
              <Text style={cardValue}>{objet}</Text>
            </>
          )}

          {dateEvenement && (
            <>
              <Text style={cardLabel}>Date de l'événement</Text>
              <Text style={cardValue}>{dateEvenement}</Text>
            </>
          )}

          {lieuEvenement && (
            <>
              <Text style={cardLabel}>Lieu</Text>
              <Text style={cardValue}>{lieuEvenement}</Text>
            </>
          )}

          {message && (
            <>
              <Hr style={hr} />
              <Text style={cardLabel}>Message</Text>
              <Text style={messageStyle}>{message}</Text>
            </>
          )}
        </Section>

        {lienDemande && (
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={lienDemande} style={button}>
              Répondre au client
            </Button>
          </Section>
        )}

        <Text style={footer}>
          Connectez-vous à votre espace pro pour répondre directement depuis la messagerie.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Nouvelle demande de devis${d?.clientNom ? ` de ${d.clientNom}` : ''}`,
  displayName: 'Nouveau contact (prestataire)',
  previewData: {
    prestataireNom: 'Atelier Marie',
    clientNom: 'Sophie Durand',
    clientEmail: 'sophie.durand@example.com',
    clientTelephone: '+33 6 12 34 56 78',
    objet: 'Mariage',
    dateEvenement: '15 juin 2025',
    lieuEvenement: 'Château de Versailles',
    message: 'Bonjour, nous serions intéressés par vos services pour notre mariage en juin prochain. Pouvez-vous nous envoyer un devis pour 120 invités ?',
    lienDemande: 'https://lesnoces.net/espace-pro/demandes',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Montserrat, Arial, sans-serif' }
const container = { padding: '0 0 32px', maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#F5EFE3', padding: '28px 28px', textAlign: 'center' as const, marginBottom: '32px' }
const logoImg = { display: 'block', margin: '0 auto', height: '48px', width: 'auto' }
const h1 = { fontFamily: 'Playfair Display, Georgia, "Times New Roman", serif', fontSize: '26px', fontWeight: 'normal', color: '#2C3E50', margin: '0 28px 16px', lineHeight: '1.3' }
const text = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '0 28px 24px', fontFamily: 'Montserrat, Arial, sans-serif' }
const card = { backgroundColor: '#FAF7F1', padding: '24px', borderRadius: '4px', border: '1px solid #E8E0D0', margin: '0 28px' }
const cardLabel = { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#A57D27', margin: '12px 0 4px', fontWeight: 'bold', fontFamily: 'Montserrat, Arial, sans-serif' }
const cardValue = { fontSize: '15px', color: '#2C3E50', margin: '0 0 4px', fontFamily: 'Montserrat, Arial, sans-serif' }
const messageStyle = { fontSize: '14px', color: '#4A4A4A', lineHeight: '1.6', margin: 0, fontFamily: 'Montserrat, Arial, sans-serif', whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#E8E0D0', margin: '16px 0' }
const button = { backgroundColor: '#A57D27', color: '#ffffff', padding: '12px 28px', borderRadius: '2px', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontFamily: 'Montserrat, Arial, sans-serif' }
const footer = { fontSize: '12px', color: '#999', margin: '32px 28px 0', textAlign: 'center' as const, fontFamily: 'Montserrat, Arial, sans-serif' }
