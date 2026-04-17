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
  lienMessagerie?: string
}

const Email = ({
  clientPrenom,
  prestataireNom,
  messageExtrait,
  lienMessagerie,
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>{prestataireNom ?? 'Un prestataire'} vous a répondu sur {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>{SITE_NAME}</Text>
        </Section>

        <Heading style={h1}>Vous avez un nouveau message</Heading>

        {messageExtrait && (
          <Section style={card}>
            <Text style={cardLabel}>{prestataireNom ?? 'Un prestataire'}</Text>
            <Text style={messageStyle}>{messageExtrait}</Text>
          </Section>
        )}

        <Text style={text}>
          Bonjour{clientPrenom ? ` ${clientPrenom}` : ''}, {prestataireNom ?? 'un prestataire'} vient de vous répondre concernant votre demande de devis.
        </Text>

        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={lienMessagerie ?? 'https://lesnoces.net/mon-compte/messagerie'} style={button}>
            Lire et répondre
          </Button>
        </Section>

        <Text style={footer}>
          Retrouvez l'historique complet de votre conversation dans votre espace personnel.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `${d?.prestataireNom ?? 'Un prestataire'} vous a répondu`,
  displayName: 'Réponse prestataire (client connecté)',
  previewData: {
    clientPrenom: 'Sophie',
    prestataireNom: 'Atelier Marie',
    messageExtrait: 'Bonjour Sophie, merci pour votre demande ! Je serais ravie de vous accompagner pour votre mariage. Voici notre proposition...',
    lienMessagerie: 'https://lesnoces.net/mon-compte/messagerie',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, "Times New Roman", serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const header = { borderBottom: '1px solid #E8E0D0', paddingBottom: '16px', marginBottom: '28px' }
const brand = { fontSize: '20px', fontWeight: 'bold', color: '#A57D27', letterSpacing: '0.05em', margin: 0 }
const h1 = { fontSize: '24px', fontWeight: 'normal', color: '#2C3E50', margin: '0 0 16px', lineHeight: '1.3' }
const text = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '0 0 16px' }
const card = { backgroundColor: '#FAF7F1', padding: '28px 24px', borderRadius: '6px', border: '1px solid #E8E0D0', margin: '24px 0 32px' }
const cardLabel = { fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#A57D27', margin: '0 0 12px', fontWeight: 'bold', fontFamily: 'Arial, sans-serif' }
const messageStyle = { fontSize: '17px', color: '#2C3E50', lineHeight: '1.6', margin: 0, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' as const }
const button = { backgroundColor: '#A57D27', color: '#ffffff', padding: '12px 28px', borderRadius: '2px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none', letterSpacing: '0.05em', textTransform: 'uppercase' as const }
const footer = { fontSize: '12px', color: '#999', margin: '32px 0 0', textAlign: 'center' as const, fontFamily: 'Arial, sans-serif' }
