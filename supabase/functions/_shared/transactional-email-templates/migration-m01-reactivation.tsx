import { makeMigrationTemplate } from './migration-template-factory.tsx'

export const template = makeMigrationTemplate({
  key: 'migration_m01_reactivation',
  subject: 'Découvrez notre nouveau site LesNoces.net',
  preview: 'Votre profil prestataire vous y attend',
  displayName: 'Migration M-01 · Invitation à réactiver',
  previewData: {
    nom_commercial: 'Atelier Marie Fleurs',
    magic_link: 'https://lesnoces.net/accept-invitation?token=exemple',
    charte_url: 'https://lesnoces.net/charte-qualite',
  },
})
