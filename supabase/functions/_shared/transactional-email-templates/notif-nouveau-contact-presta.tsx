import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'LesNoces.net'

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
    <Head />
    <Preview>Nouvelle demande de devis sur {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>{SITE_NAME}</Text>
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

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, "Times New Roman", serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const header = { borderBottom: '1px solid #E8E0D0', paddingBottom: '16px', marginBottom: '28px' }
const brand = { fontSize: '20px', fontWeight: 'bold', color: '#A57D27', letterSpacing: '0.05em', margin: 0 }
const h1 = { fontSize: '24px', fontWeight: 'normal', color: '#2C3E50', margin: '0 0 16px', lineHeight: '1.3' }
const text = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '0 0 24px' }
const card = { backgroundColor: '#FAF7F1', padding: '24px', borderRadius: '4px', border: '1px solid #E8E0D0' }
const cardLabel = { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#A57D27', margin: '12px 0 4px', fontWeight: 'bold' }
const cardValue = { fontSize: '15px', color: '#2C3E50', margin: '0 0 4px', fontFamily: 'Arial, sans-serif' }
const messageStyle = { fontSize: '14px', color: '#4A4A4A', lineHeight: '1.6', margin: 0, fontFamily: 'Arial, sans-serif', whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#E8E0D0', margin: '16px 0' }
const button = { backgroundColor: '#A57D27', color: '#ffffff', padding: '12px 28px', borderRadius: '2px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none', letterSpacing: '0.05em', textTransform: 'uppercase' as const }
const footer = { fontSize: '12px', color: '#999', margin: '32px 0 0', textAlign: 'center' as const, fontFamily: 'Arial, sans-serif' }
