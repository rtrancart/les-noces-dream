import { makeMigrationTemplate } from './migration-template-factory.tsx'

export const template = makeMigrationTemplate({
  key: 'migration_m02_relance',
  subject: 'Votre fiche est prête — il ne manque que vous',
  preview: "Elle n'est pas encore visible auprès des futurs mariés",
  displayName: 'Migration M-02 · Relance activation 1',
  previewData: {
    nom_commercial: 'Atelier Marie Fleurs',
    magic_link: 'https://lesnoces.net/accept-invitation?token=exemple',
  },
})
