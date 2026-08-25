import { makeMigrationTemplate } from './migration-template-factory.tsx'

export const template = makeMigrationTemplate({
  key: 'migration_m05_charte',
  subject: 'Une dernière formalité pour rester visible sur LesNoces.net',
  preview: 'Signez la Charte Qualité en quelques minutes',
  displayName: 'Migration M-05 · Charte non signée',
  previewData: {
    nom_commercial: 'Atelier Marie Fleurs',
    charte_url: 'https://lesnoces.net/signer-la-charte',
    charte_exemptee_jusqua: '15 mars 2026',
  },
})
