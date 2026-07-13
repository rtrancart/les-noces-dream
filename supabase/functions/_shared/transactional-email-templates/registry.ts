/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as notifNouveauContactPresta } from './notif-nouveau-contact-presta.tsx'
import { template as notifNouveauContactPrestaSansCompte } from './notif-nouveau-contact-presta-sans-compte.tsx'
import { template as notifReponseClientAvecCompte } from './notif-reponse-client-avec-compte.tsx'
import { template as notifReponseClientSansCompte } from './notif-reponse-client-sans-compte.tsx'
import { template as notifReponsePresta } from './notif-reponse-presta.tsx'
import { template as invitationPrestataire } from './invitation-prestataire.tsx'
import { template as relanceSignatureCharte } from './relance-signature-charte.tsx'
import { template as notifNouvelleVersionCharte } from './notif-nouvelle-version-charte.tsx'
import { template as demandeReactivation } from './demande-reactivation.tsx'
import { template as notifNouvelleSoumissionFiche } from './notif-nouvelle-soumission-fiche.tsx'
import { template as validationPublicationFiche } from './validation-publication-fiche.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'notif_nouveau_contact_presta': notifNouveauContactPresta,
  'notif_nouveau_contact_presta_sans_compte': notifNouveauContactPrestaSansCompte,
  'notif_reponse_client_avec_compte': notifReponseClientAvecCompte,
  'notif_reponse_client_sans_compte': notifReponseClientSansCompte,
  'notif_reponse_presta': notifReponsePresta,
  'invitation_prestataire': invitationPrestataire,
  'relance_signature_charte': relanceSignatureCharte,
  'notif_nouvelle_version_charte': notifNouvelleVersionCharte,
  'demande_reactivation': demandeReactivation,
  'notif_nouvelle_soumission_fiche': notifNouvelleSoumissionFiche,
  'validation_publication_fiche': validationPublicationFiche,
}
