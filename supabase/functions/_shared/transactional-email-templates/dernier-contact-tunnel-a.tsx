import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

// Dernier contact Tunnel A (J+14). Corps seul — la coquille commune est ajoutée
// par email-shell.ts au moment de l'envoi. Cette version React sert de filet de
// sécurité si la ligne DB email_textes est inactive.

const OR = '#A57D27'
const ABYSSE = '#0F141E'
const CREAM = '#FAF7F1'
const TEXT = '#4A4A4A'
const MUTED = '#7A7A7A'
const SERIF = "'Playfair Display', Georgia, serif"
const SANS = 'Montserrat, Arial, sans-serif'

interface Props {
  prenom?: string
  nom_commercial?: string
  magic_link?: string
  lien_retrait?: string
}

const Email = ({ prenom, nom_commercial, magic_link, lien_retrait }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Un dernier mot avant de vous laisser tranquille.</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: SANS }}>
      <Container style={{ padding: '32px', maxWidth: '600px' }}>
        <Text style={eyebrow}>DERNIER MESSAGE</Text>
        <Heading style={h1}>Votre profil n'attend que vous</Heading>
        <Text style={p}>Bonjour {prenom ?? ''},</Text>
        <Text style={p}>
          C'est notre dernier message — nous ne souhaitons pas vous solliciter davantage.
        </Text>
        <Text style={p}>
          Votre profil <strong>{nom_commercial ?? ''}</strong> a été créé à votre nom il y a deux semaines,
          après que notre équipe a étudié votre travail et choisi de le retenir. Il est toujours en attente,
          et nous ne le publierons jamais sans votre accord.
        </Text>
        <Section style={note}>
          <Text style={noteText}>
            Deux possibilités, et les deux nous conviennent : vous prenez quelques minutes pour découvrir
            votre espace, ou vous nous dites que ce n'est pas le moment — nous retirerons votre profil.
          </Text>
        </Section>
        {magic_link && (
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={magic_link} style={button}>Découvrir mon espace</Button>
          </Section>
        )}
        {lien_retrait && (
          <Text style={retraitLine}>
            Vous préférez que nous retirions votre profil ?{' '}
            <Link href={lien_retrait} style={retraitLink}>Nous en informer</Link>.
          </Text>
        )}
        <Hr style={hr} />
        <Text style={subEyebrow}>CE QUE VOUS LAISSEZ DE CÔTÉ</Text>
        <Text style={pMuted}>
          Une visibilité auprès de couples qui cherchent des prestataires de votre niveau,
          90 jours entièrement gratuits pour l'éprouver, et une sélection dont l'exigence —
          validée par notre Charte Qualité — fait toute la valeur.
        </Text>
        <Text style={italic}>
          Au plaisir peut-être de vous accueillir prochainement parmi les professionnels
          sélectionnés par LesNoces.net.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Dernier message concernant votre profil',
  displayName: 'Dernier contact Tunnel A (J+14)',
  previewData: {
    prenom: 'Marie',
    nom_commercial: 'Atelier Marie Fleurs',
    magic_link: 'https://lesnoces.net/accept-invitation?token=xxx',
    lien_retrait: 'mailto:contact@lesnoces.net?subject=Retrait%20de%20mon%20profil%20LesNoces',
  },
} satisfies TemplateEntry

const eyebrow = { margin: '0 0 12px', fontFamily: SANS, fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: OR, fontWeight: 600 as const }
const h1 = { margin: '0 0 20px', fontFamily: SERIF, fontWeight: 500 as const, fontSize: '28px', lineHeight: '1.2', color: ABYSSE }
const p = { margin: '0 0 16px', fontFamily: SANS, fontSize: '15px', lineHeight: '1.65', color: TEXT }
const pMuted = { margin: '0 0 16px', fontFamily: SANS, fontSize: '14px', lineHeight: '1.65', color: MUTED }
const note = { background: CREAM, borderLeft: `3px solid ${OR}`, padding: '16px 20px', margin: '20px 0' }
const noteText = { margin: 0, fontFamily: SANS, fontSize: '14.5px', lineHeight: '1.6', color: TEXT }
const button = { backgroundColor: OR, color: '#ffffff', padding: '14px 32px', borderRadius: '2px', fontFamily: SANS, fontSize: '13px', fontWeight: 600 as const, letterSpacing: '0.1em', textTransform: 'uppercase' as const, textDecoration: 'none' }
const retraitLine = { margin: '0 0 8px', textAlign: 'center' as const, fontFamily: SANS, fontSize: '13px', color: MUTED }
const retraitLink = { color: OR, textDecoration: 'underline' }
const hr = { borderColor: '#E8E0D0', margin: '32px 0 24px' }
const subEyebrow = { margin: '0 0 12px', fontFamily: SANS, fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: OR, fontWeight: 600 as const }
const italic = { margin: '20px 0 0', fontFamily: SERIF, fontStyle: 'italic' as const, fontSize: '14px', lineHeight: '1.6', color: MUTED }
