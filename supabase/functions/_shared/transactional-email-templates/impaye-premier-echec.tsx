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
    <Preview>Votre paiement n'a pas abouti — mettez à jour votre carte</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="160" height="48" style={logoImg} />
        </Section>
        <Heading style={h1}>Bonjour{prenom ? ` ${prenom}` : ''},</Heading>
        <Text style={text}>
          Le prélèvement correspondant à votre abonnement {SITE_NAME} n'a pas pu être effectué.
        </Text>
        <Text style={text}>
          Dans la plupart des cas, cela s'explique par une raison simple : carte bancaire expirée, fonds
          temporairement insuffisants, carte récemment remplacée, ou refus ponctuel de l'organisme bancaire.
        </Text>
        <Text style={text}>
          À ce stade, aucune action urgente n'est requise, et rien n'est interrompu :
        </Text>
        <Text style={textList}>✅ Votre fiche{nom_commercial ? ` ${nom_commercial}` : ''} reste visible sur {SITE_NAME}</Text>
        <Text style={textList}>✅ Vous continuez à recevoir des demandes de futurs mariés et d'entreprises</Text>
        <Text style={textList}>✅ Votre abonnement reste actif</Text>
        <Text style={text}>
          Notre système représentera automatiquement le paiement dans les prochains jours. Pour éviter toute
          difficulté, nous vous invitons simplement à vérifier ou mettre à jour votre moyen de paiement depuis
          notre portail sécurisé.
        </Text>
        {portail_url && (
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={portail_url} style={button}>Mettre à jour ma carte bancaire</Button>
          </Section>
        )}
        <Text style={text}>
          L'opération ne prend qu'une minute. Si vous pensez qu'il s'agit d'une erreur ou rencontrez la moindre
          difficulté, notre équipe reste à votre disposition.
        </Text>
        <Text style={signature}>Bien cordialement,<br />L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: `Votre paiement n'a pas abouti — mettez à jour votre carte`,
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
const textList = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '0 28px 8px' }
const button = { backgroundColor: '#A57D27', color: '#ffffff', padding: '14px 32px', borderRadius: '2px', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' as const }
const signature = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '24px 28px 0' }
