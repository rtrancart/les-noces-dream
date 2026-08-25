// Fabrique de templates pour la chaîne « prestataires migrés » (M-01 → M-05).
// Le corps HTML est fourni tel quel (MIGRATION_BODIES) ; ce composant sert de
// filet de sécurité côté code si la ligne email_textes est absente/inactive.
// Jetable : supprimable après la campagne de reprise du parc.
import * as React from 'npm:react@18.3.1'
import { Body, Head, Html, Preview } from 'npm:@react-email/components@0.0.22'
import { MIGRATION_BODIES } from './migration-bodies.ts'
import type { TemplateEntry } from './registry.ts'

export function makeMigrationTemplate(opts: {
  key: string
  subject: string
  preview: string
  displayName: string
  previewData: Record<string, any>
}): TemplateEntry {
  const raw = MIGRATION_BODIES[opts.key] ?? ''

  const Email = (data: Record<string, any> = {}) => {
    const html = raw.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k: string) => {
      const v = data?.[k]
      return v === undefined || v === null || v === '' ? `{{${k}}}` : String(v)
    })
    return (
      <Html lang="fr" dir="ltr">
        <Head />
        <Preview>{opts.preview}</Preview>
        <Body style={{ backgroundColor: '#ffffff', margin: 0, padding: 0 }}>
          {/* Contenu statique maîtrisé (pas d'HTML issu de l'utilisateur). */}
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </Body>
      </Html>
    )
  }

  return {
    component: Email,
    subject: opts.subject,
    displayName: opts.displayName,
    previewData: opts.previewData,
  }
}
