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
import { template as notifReponseClientAvecCompte } from './notif-reponse-client-avec-compte.tsx'
import { template as notifReponseClientSansCompte } from './notif-reponse-client-sans-compte.tsx'
import { template as notifReponsePresta } from './notif-reponse-presta.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'notif_nouveau_contact_presta': notifNouveauContactPresta,
  'notif_reponse_client_avec_compte': notifReponseClientAvecCompte,
  'notif_reponse_client_sans_compte': notifReponseClientSansCompte,
  'notif_reponse_presta': notifReponsePresta,
}
