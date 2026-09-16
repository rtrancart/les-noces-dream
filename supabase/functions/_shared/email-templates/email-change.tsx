/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

const LOGO_URL = 'https://egbohbwiywgyyculswvf.supabase.co/storage/v1/object/public/email-assets/brand/logo-wordmark-abysse.png'

interface Props {
  siteName?: string
  oldEmail?: string
  newEmail?: string
  email?: string
  confirmationUrl?: string
}

export const EmailChangeEmail = ({ siteName = 'LesNoces.net', oldEmail, newEmail, confirmationUrl }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Confirmez votre nouvelle adresse email {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt={siteName} width="160" height="48" style={logoImg} />
        </Section>
        <Heading style={h1}>Confirmez votre nouvelle adresse email</Heading>
        <Text style={text}>
          Une demande de changement d'adresse email a été effectuée sur votre compte {siteName}.
        </Text>
        {(oldEmail || newEmail) && (
          <Text style={text}>
            {oldEmail && <>Ancienne adresse : <strong>{oldEmail}</strong><br /></>}
            {newEmail && <>Nouvelle adresse : <strong>{newEmail}</strong></>}
          </Text>
        )}
        <Text style={text}>
          Pour valider ce changement, cliquez sur le bouton ci-dessous.
        </Text>
        {confirmationUrl && (
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={confirmationUrl} style={button}>Confirmer le changement</Button>
          </Section>
        )}
        <Text style={hint}>
          Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br />
          <span style={linkText}>{confirmationUrl}</span>
        </Text>
        <Text style={footer}>
          Si vous n'êtes pas à l'origine de cette demande, ignorez cet email et contactez-nous
          rapidement pour sécuriser votre compte.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Montserrat, Arial, sans-serif' }
const container = { padding: '0 0 32px', maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#F5EFE3', padding: '28px', textAlign: 'center' as const, marginBottom: '32px' }
const logoImg = { display: 'block', margin: '0 auto', height: '48px', width: 'auto' }
const h1 = { fontFamily: 'Playfair Display, Georgia, serif', fontSize: '26px', fontWeight: 'normal' as const, color: '#2C3E50', margin: '0 28px 16px', lineHeight: '1.3' }
const text = { fontSize: '15px', color: '#4A4A4A', lineHeight: '1.6', margin: '0 28px 16px' }
const button = { backgroundColor: '#A57D27', color: '#ffffff', padding: '14px 32px', borderRadius: '2px', fontSize: '13px', fontWeight: 'bold' as const, textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' as const }
const hint = { fontSize: '12px', color: '#777', margin: '0 28px 24px', lineHeight: '1.6' }
const linkText = { color: '#A57D27', wordBreak: 'break-all' as const }
const footer = { fontSize: '12px', color: '#999', margin: '32px 28px 0', textAlign: 'center' as const }
