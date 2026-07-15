import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'LesNoces.net'
const LOGO_URL = 'https://egbohbwiywgyyculswvf.supabase.co/storage/v1/object/public/email-assets/logo-lesnoces.png'

interface Props {
  prenom?: string
  nom_commercial?: string
  portail_url?: string
}

const Email = ({ prenom, nom_commercial, portail_url }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre paiement n'a pas pu être prélevé — mettez à jour votre moyen de paiement</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="160" height="48" style={logoImg} />
        </Section>
        <Heading style={h1}>Bonjour{prenom ? ` ${prenom}` : ''},</Heading>
        <Text style={text}>
          Le prélèvement de votre abonnement {SITE_NAME}
          {nom_commercial ? ` pour la fiche ${nom_commercial}` : ''} n'a pas pu aboutir.
        </Text>
        <Text style={text}>
          Cela arrive parfois : carte expirée, plafond atteint, ou simple refus temporaire de votre banque.
          Aucune action urgente n'est requise — Stripe réessaiera automatiquement dans les prochains jours.
        </Text>
        <Text style={text}>
          Pour éviter toute interruption, vous pouvez dès maintenant vérifier ou mettre à jour votre moyen
          de paiement depuis votre espace de gestion.
        </Text>
        {portail_url && (
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={portail_url} style={button}>Mettre à jour mon moyen de paiement</Button>
          </Section>
        )}
        <Text style={footer}>Votre fiche reste visible normalement pendant cette période.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: `Votre paiement n'a pas pu être prélevé`,
  displayName: 'Impayé — 1er échec',
  previewData: {
    prenom: 'Marie',
    nom_commercial: 'Atelier Marie Fleurs',
    portail_url: 'https://lesnoces.net/espace-pro/abonnement',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Montserrat, Arial, sans-serif' }
const container = { padding: '0 0 32px', maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#F5EFE3', padding: '28px', textAlign: 'center' as const, marginBottom: '32px' }
const logoImg = { display: 'block', margin: '0 auto', height: '48px', width: 'auto' }
const h1 = { fontFamily: 'Playfair Display, Georgia, serif', fontSize: '24px', fontWeight: 'normal', color: '#2C3E50', margin: '0 28px 16px' }
const text = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '0 28px 16px' }
const button = { backgroundColor: '#A57D27', color: '#ffffff', padding: '14px 32px', borderRadius: '2px', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' as const }
const footer = { fontSize: '12px', color: '#999', margin: '32px 28px 0', textAlign: 'center' as const }
