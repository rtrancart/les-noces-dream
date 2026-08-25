import { makeMigrationTemplate } from './migration-template-factory.tsx'

export const template = makeMigrationTemplate({
  key: 'migration_m04_relance',
  subject: 'Une dernière relance pour réactiver votre espace LesNoces.net',
  preview: 'Rendez-vous visible auprès de milliers de mariés',
  displayName: 'Migration M-04 · Relance activation 3 (dernière)',
  previewData: {
    nom_commercial: 'Atelier Marie Fleurs',
    magic_link: 'https://lesnoces.net/accept-invitation?token=exemple',
  },
})
