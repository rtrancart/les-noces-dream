import { makeMigrationTemplate } from './migration-template-factory.tsx'

export const template = makeMigrationTemplate({
  key: 'migration_m03_relance',
  subject: "Votre fiche n'est pas visible sur LesNoces.net",
  preview: 'Vous pouvez la réactiver en quelques clics',
  displayName: 'Migration M-03 · Relance activation 2',
  previewData: {
    nom_commercial: 'Atelier Marie Fleurs',
    magic_link: 'https://lesnoces.net/accept-invitation?token=exemple',
  },
})
