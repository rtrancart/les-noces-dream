/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

const LOGO_URL = 'https://egbohbwiywgyyculswvf.supabase.co/storage/v1/object/public/email-assets/brand/logo-wordmark-abysse.png'

interface Props {
  siteName?: string
  token?: string
}

export const ReauthenticationEmail = ({ siteName = 'LesNoces.net', token }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre code de vérification {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt={siteName} width="160" height="48" style={logoImg} />
        </Section>
        <Heading style={h1}>Code de vérification</Heading>
        <Text style={text}>
          Pour poursuivre votre action sur {siteName}, veuillez saisir le code de vérification
          ci-dessous. Il est valable quelques minutes seulement.
        </Text>
        {token && (
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <div style={code}>{token}</div>
          </Section>
        )}
        <Text style={footer}>
          Si vous n'êtes pas à l'origine de cette demande, ignorez cet email et modifiez votre
          mot de passe par précaution.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Montserrat, Arial, sans-serif' }
const container = { padding: '0 0 32px', maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#F5EFE3', padding: '28px', textAlign: 'center' as const, marginBottom: '32px' }
const logoImg = { display: 'block', margin: '0 auto', height: '48px', width: 'auto' }
const h1 = { fontFamily: 'Playfair Display, Georgia, serif', fontSize: '26px', fontWeight: 'normal' as const, color: '#2C3E50', margin: '0 28px 16px', lineHeight: '1.3' }
const text = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '0 28px 16px' }
const code = {
  display: 'inline-block',
  fontFamily: 'Playfair Display, Georgia, serif',
  fontSize: '32px',
  letterSpacing: '0.4em',
  color: '#A57D27',
  backgroundColor: '#F5EFE3',
  padding: '18px 28px',
  borderRadius: '2px',
  fontWeight: 'bold' as const,
}
const footer = { fontSize: '12px', color: '#999', margin: '32px 28px 0', textAlign: 'center' as const }
