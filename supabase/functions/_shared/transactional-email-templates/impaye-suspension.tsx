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
    <Preview>Votre fiche a été suspendue — paiement non reçu</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt={SITE_NAME} width="160" height="48" style={logoImg} />
        </Section>
        <Heading style={h1}>Bonjour{prenom ? ` ${prenom}` : ''},</Heading>
        <Text style={text}>
          Après plusieurs tentatives de prélèvement restées infructueuses, votre fiche
          {nom_commercial ? ` ${nom_commercial}` : ''} a été suspendue à compter de ce jour.
        </Text>
        <Text style={text}>
          Votre établissement n'apparaît désormais plus dans les résultats de recherche de {SITE_NAME} et ne
          peut plus recevoir de nouvelles demandes de la part des futurs mariés, particuliers ou entreprises.
        </Text>
        <Text style={text}>
          Rassurez-vous : aucune donnée n'a été supprimée. Votre fiche, vos photos et l'ensemble de vos
          informations sont conservés et seront rétablis dès la régularisation de votre paiement.
        </Text>
        <Text style={text}>
          Réactiver votre fiche est simple et immédiat : il vous suffit de reprendre votre abonnement depuis
          votre espace, en renseignant un moyen de paiement valide.
        </Text>
        {reactivation_url && (
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={reactivation_url} style={button}>Réactiver ma fiche</Button>
          </Section>
        )}
        <Text style={text}>
          Dès le paiement confirmé, votre visibilité est rétablie et vous recevez à nouveau des demandes, sans
          avoir à recréer quoi que ce soit.
        </Text>
        <Text style={text}>
          Si vous souhaitez en parler ou pensez qu'il s'agit d'une erreur, notre équipe reste à votre écoute.
        </Text>
        <Text style={signature}>Bien cordialement,<br />Nathalie<br />Fondatrice de {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: `Votre fiche a été suspendue — paiement non reçu`,
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
const button = { backgroundColor: '#A57D27', color: '#ffffff', padding: '14px 32px', borderRadius: '2px', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' as const }
const signature = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '24px 28px 0' }
