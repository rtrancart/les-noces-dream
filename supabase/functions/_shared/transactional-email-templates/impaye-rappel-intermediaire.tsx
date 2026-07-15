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
    <Preview>Votre paiement est toujours en attente — évitez la suspension de votre fiche</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="160" height="48" style={logoImg} />
        </Section>
        <Heading style={h1}>Bonjour{prenom ? ` ${prenom}` : ''},</Heading>
        <Text style={text}>
          Malgré nos tentatives, le règlement de votre abonnement {SITE_NAME} n'a toujours pas pu être effectué.
        </Text>
        <Text style={textHighlight}>
          Nous attirons votre attention sur ce point : sans régularisation, votre fiche
          {nom_commercial ? ` ${nom_commercial}` : ''} sera prochainement suspendue, une fois nos tentatives
          de prélèvement épuisées.
        </Text>
        <Text style={text}>Aujourd'hui, votre fiche est encore pleinement active :</Text>
        <Text style={textList}>✅ Visible auprès des futurs mariés et des entreprises</Text>
        <Text style={textList}>✅ Référencée dans les résultats de recherche</Text>
        <Text style={textList}>✅ En mesure de recevoir de nouvelles demandes</Text>
        <Text style={text}>En cas de suspension, en revanche :</Text>
        <Text style={textList}>❌ Votre fiche ne sera plus visible sur {SITE_NAME}</Text>
        <Text style={textList}>❌ Vous ne recevrez plus de nouvelles demandes</Text>
        <Text style={textList}>❌ Les opportunités en cours pourront être impactées</Text>
        <Text style={text}>
          Il suffit le plus souvent de mettre à jour une carte expirée ou remplacée pour tout régulariser.
        </Text>
        {portail_url && (
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={portail_url} style={button}>Régulariser mon paiement</Button>
          </Section>
        )}
        <Text style={text}>
          Si vous avez déjà effectué cette mise à jour récemment, vous pouvez ignorer cet email : le prochain
          prélèvement se fera automatiquement.
        </Text>
        <Text style={text}>Pour toute question, notre équipe est là pour vous aider.</Text>
        <Text style={signature}>Bien cordialement,<br />L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: `Votre paiement est toujours en attente — évitez la suspension de votre fiche`,
  displayName: 'Impayé — rappel intermédiaire',
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
const textList = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '0 28px 8px' }
const textHighlight = { fontSize: '15px', color: '#A57D27', lineHeight: '1.6', margin: '0 28px 16px', fontWeight: 'bold' as const }
const button = { backgroundColor: '#A57D27', color: '#ffffff', padding: '14px 32px', borderRadius: '2px', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' as const }
const signature = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '24px 28px 0' }
