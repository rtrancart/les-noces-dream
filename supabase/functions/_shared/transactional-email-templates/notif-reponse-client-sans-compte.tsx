import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'LesNoces.net'

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
    <Head />
    <Preview>{prestataireNom ?? 'Un prestataire'} vous a répondu sur {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>{SITE_NAME}</Text>
        </Section>

        <Heading style={h1}>Vous avez une nouvelle réponse</Heading>
        <Text style={text}>
          Bonjour{clientPrenom ? ` ${clientPrenom}` : ''},
        </Text>
        <Text style={text}>
          <strong style={{ color: '#2C3E50' }}>{prestataireNom ?? 'Un prestataire'}</strong> vient de répondre à votre demande de devis.
        </Text>

        {messageExtrait && (
          <Section style={card}>
            <Text style={messageStyle}>{messageExtrait}</Text>
          </Section>
        )}

        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
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

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, "Times New Roman", serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const header = { borderBottom: '1px solid #E8E0D0', paddingBottom: '16px', marginBottom: '28px' }
const brand = { fontSize: '20px', fontWeight: 'bold', color: '#A57D27', letterSpacing: '0.05em', margin: 0 }
const h1 = { fontSize: '24px', fontWeight: 'normal', color: '#2C3E50', margin: '0 0 16px', lineHeight: '1.3' }
const text = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '0 0 16px' }
const card = { backgroundColor: '#FAF7F1', padding: '24px', borderRadius: '4px', border: '1px solid #E8E0D0', borderLeft: '3px solid #A57D27', margin: '24px 0' }
const messageStyle = { fontSize: '14px', color: '#4A4A4A', lineHeight: '1.6', margin: 0, fontFamily: 'Arial, sans-serif', fontStyle: 'italic' as const, whiteSpace: 'pre-wrap' as const }
const button = { backgroundColor: '#A57D27', color: '#ffffff', padding: '12px 28px', borderRadius: '2px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none', letterSpacing: '0.05em', textTransform: 'uppercase' as const }
const buttonOutline = { backgroundColor: 'transparent', color: '#A57D27', padding: '10px 24px', borderRadius: '2px', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none', letterSpacing: '0.05em', textTransform: 'uppercase' as const, border: '1px solid #A57D27' }
const hint = { fontSize: '12px', color: '#999', margin: '12px 0 0', fontFamily: 'Arial, sans-serif' }
const separator = { textAlign: 'center' as const, margin: '24px 0' }
const separatorText = { fontSize: '11px', color: '#A57D27', letterSpacing: '0.15em', margin: 0, fontFamily: 'Arial, sans-serif' }
const signupCard = { textAlign: 'center' as const, padding: '24px', backgroundColor: '#FAF7F1', borderRadius: '4px', margin: '0 0 24px' }
const signupTitle = { fontSize: '16px', color: '#2C3E50', fontWeight: 'bold', margin: '0 0 8px' }
const signupText = { fontSize: '13px', color: '#666', margin: '0 0 16px', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' }
const footer = { fontSize: '12px', color: '#999', margin: '32px 0 0', textAlign: 'center' as const, fontFamily: 'Arial, sans-serif' }
