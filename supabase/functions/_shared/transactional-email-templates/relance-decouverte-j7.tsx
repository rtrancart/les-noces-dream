import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

// Corps seul — le header/footer/signature communs sont ajoutés par email-shell.ts au moment de l'envoi.
// Cette version React sert de filet de sécurité si la ligne DB email_textes est inactive.

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
}

const Email = ({ prenom, nom_commercial, magic_link }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre profil est prêt, et vos 90 jours n'ont pas encore commencé.</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: SANS }}>
      <Container style={{ padding: '32px', maxWidth: '600px' }}>
        <Text style={eyebrow}>SÉLECTION LESNOCES</Text>
        <Heading style={h1}>Votre place vous attend toujours</Heading>
        <Text style={p}>Bonjour {prenom ?? ''},</Text>
        <Text style={p}>
          Il y a une semaine, nous vous annoncions que <strong>{nom_commercial ?? 'votre établissement'}</strong> faisait
          partie des prestataires que nous avons sélectionnés pour LesNoces.net. Vous n'avez peut-être simplement pas eu
          le temps d'y jeter un œil.
        </Text>
        <Text style={p}>
          Votre profil a été créé par nos soins, il n'attend plus que vous pour être finalisé et visible auprès de milliers de clients.
        </Text>
        <Section style={note}>
          <Text style={noteText}>
            ✨ Il vous suffit de vous connecter, de compléter votre profil et de signer notre Charte de Qualité pour
            bénéficier de <strong>90 jours de visibilité gratuits</strong>.
          </Text>
        </Section>
        {magic_link && (
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={magic_link} style={button}>Découvrir mon espace</Button>
          </Section>
        )}
        <Hr style={hr} />
        <Text style={subEyebrow}>POURQUOI LESNOCES EST DIFFÉRENT</Text>
        <Section>
          <Text style={item}><span style={check}>✓</span> <strong style={itemLabel}>Une sélection à la main</strong> — pas d'inscription automatique, pas d'annuaire ouvert. Chaque professionnel est étudié individuellement.</Text>
          <Text style={item}><span style={check}>✓</span> <strong style={itemLabel}>Des couples qui viennent pour l'exigence</strong> — ils savent que chaque prestataire présenté a été validé avant d'apparaître.</Text>
          <Text style={item}><span style={check}>✓</span> <strong style={itemLabel}>Une Charte Qualité partagée</strong> — le socle commun qui protège votre positionnement autant que le nôtre.</Text>
          <Text style={item}><span style={check}>✓</span> <strong style={itemLabel}>90 jours pour juger sur pièces</strong> — sans carte bancaire, sans engagement.</Text>
        </Section>
        <Text style={italic}>
          Une question avant de vous lancer ? Répondez simplement à cet email, ou appelez-nous au 02 96 01 00 17 —
          nous prenons le temps d'échanger avec chaque professionnel.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Votre profil vous attend toujours, {{prenom}}',
  displayName: 'Relance découverte J+7 (Tunnel A)',
  previewData: {
    prenom: 'Marie',
    nom_commercial: 'Atelier Marie Fleurs',
    magic_link: 'https://lesnoces.net/accept-invitation?token=xxx',
  },
} satisfies TemplateEntry

const eyebrow = { margin: '0 0 12px', fontFamily: SANS, fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: OR, fontWeight: 600 as const }
const h1 = { margin: '0 0 20px', fontFamily: SERIF, fontWeight: 500 as const, fontSize: '28px', lineHeight: '1.2', color: ABYSSE }
const p = { margin: '0 0 16px', fontFamily: SANS, fontSize: '15px', lineHeight: '1.65', color: TEXT }
const note = { background: CREAM, borderLeft: `3px solid ${OR}`, padding: '16px 20px', margin: '20px 0' }
const noteText = { margin: 0, fontFamily: SANS, fontSize: '14.5px', lineHeight: '1.6', color: TEXT }
const button = { backgroundColor: OR, color: '#ffffff', padding: '14px 32px', borderRadius: '2px', fontFamily: SANS, fontSize: '13px', fontWeight: 600 as const, letterSpacing: '0.1em', textTransform: 'uppercase' as const, textDecoration: 'none' }
const hr = { borderColor: '#E8E0D0', margin: '32px 0 24px' }
const subEyebrow = { margin: '0 0 16px', fontFamily: SANS, fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: OR, fontWeight: 600 as const }
const item = { margin: '0 0 12px', fontFamily: SANS, fontSize: '14px', lineHeight: '1.6', color: TEXT }
const itemLabel = { color: ABYSSE }
const check = { color: OR, fontWeight: 700 as const, marginRight: '8px' }
const italic = { margin: '28px 0 0', fontFamily: SERIF, fontStyle: 'italic' as const, fontSize: '14px', lineHeight: '1.6', color: MUTED }
