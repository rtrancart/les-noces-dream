import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'LesNoces.net'
const LOGO_URL = 'https://egbohbwiywgyyculswvf.supabase.co/storage/v1/object/public/email-assets/logo-lesnoces.png'

interface Props {
  prenom?: string
  nom_commercial?: string
  reactivation_url?: string
}

const Email = ({ prenom, nom_commercial, reactivation_url }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre fiche {SITE_NAME} a été suspendue faute de paiement</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="160" height="48" style={logoImg} />
        </Section>
        <Heading style={h1}>Bonjour{prenom ? ` ${prenom}` : ''},</Heading>
        <Text style={text}>
          Faute de règlement après plusieurs tentatives, votre abonnement {SITE_NAME}
          {nom_commercial ? ` pour la fiche ${nom_commercial}` : ''} a été définitivement abandonné.
        </Text>
        <Text style={textHighlight}>
          Votre fiche n'est plus visible sur {SITE_NAME} à compter d'aujourd'hui.
        </Text>
        <Text style={text}>
          Vous pouvez réactiver votre visibilité à tout moment en souscrivant à nouveau depuis votre espace
          prestataire. Vos informations, photos et avis restent conservés.
        </Text>
        {reactivation_url && (
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={reactivation_url} style={button}>Réactiver ma fiche</Button>
          </Section>
        )}
        <Text style={footer}>Une question ? Répondez simplement à cet e-mail, notre équipe est là pour vous aider.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: `Votre fiche a été suspendue faute de paiement`,
  displayName: 'Impayé — suspension définitive',
  previewData: {
    prenom: 'Marie',
    nom_commercial: 'Atelier Marie Fleurs',
    reactivation_url: 'https://lesnoces.net/espace-pro/abonnement',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Montserrat, Arial, sans-serif' }
const container = { padding: '0 0 32px', maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#F5EFE3', padding: '28px', textAlign: 'center' as const, marginBottom: '32px' }
const logoImg = { display: 'block', margin: '0 auto', height: '48px', width: 'auto' }
const h1 = { fontFamily: 'Playfair Display, Georgia, serif', fontSize: '24px', fontWeight: 'normal', color: '#2C3E50', margin: '0 28px 16px' }
const text = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '0 28px 16px' }
const textHighlight = { fontSize: '15px', color: '#C0392B', lineHeight: '1.6', margin: '0 28px 16px', fontWeight: 'bold' as const }
const button = { backgroundColor: '#A57D27', color: '#ffffff', padding: '14px 32px', borderRadius: '2px', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' as const }
const footer = { fontSize: '12px', color: '#999', margin: '32px 28px 0', textAlign: 'center' as const }
