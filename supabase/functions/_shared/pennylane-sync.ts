// Synchronisation des factures Stripe vers Pennylane.
// Toujours tolérant à l'échec : la ligne locale est enregistrée même si
// l'appel Pennylane échoue (l'erreur est stockée dans la colonne `erreur`).

import {
  findCustomerByEmail,
  findCustomerByExternalReference,
  pennylaneFetch,
  PennylaneError,
  type PennylaneCustomer,
  type PennylaneInvoice,
} from './pennylane-client.ts'

// deno-lint-ignore no-explicit-any
type Supabase = any
// deno-lint-ignore no-explicit-any
type StripeInvoice = any

export interface PrestataireFacturation {
  id: string
  nom_commercial: string | null
  raison_sociale: string | null
  email_contact: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  siret: string | null
  tva_intracom: string | null
}

function toIsoDate(seconds: number | null | undefined): string | null {
  if (!seconds) return null
  return new Date(seconds * 1000).toISOString().slice(0, 10)
}

/** Crée (ou retrouve) le client Pennylane correspondant au prestataire. */
export async function ensurePennylaneCustomer(
  presta: PrestataireFacturation,
): Promise<PennylaneCustomer | null> {
  const existing = await findCustomerByExternalReference(presta.id)
  if (existing) return existing

  if (presta.email_contact) {
    const byEmail = await findCustomerByEmail(presta.email_contact)
    if (byEmail) return byEmail
  }

  const name = presta.raison_sociale || presta.nom_commercial || `Prestataire ${presta.id}`
  const payload: Record<string, unknown> = {
    name,
    external_reference: presta.id,
    emails: presta.email_contact ? [presta.email_contact] : [],
    billing_address: {
      address: presta.adresse ?? '',
      postal_code: presta.code_postal ?? '',
      city: presta.ville ?? '',
      country_alpha2: 'FR',
    },
  }
  if (presta.siret) payload.reg_no = presta.siret
  if (presta.tva_intracom) payload.vat_number = presta.tva_intracom

  // /customers est une route de lecture agrégée. La création d'une société
  // passe par la route dédiée /company_customers en API V2.
  return await pennylaneFetch<PennylaneCustomer>('/company_customers', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export interface SyncOptions {
  /** Champs supplémentaires envoyés à Pennylane (ex. { draft: true } pour un test). */
  extraInvoiceFields?: Record<string, unknown>
}

export interface SyncResult {
  ok: boolean
  error?: string
  customerId?: string | null
  customerCree?: boolean
  pennylaneInvoiceId?: string | null
  numero?: string | null
  pdfUrl?: string | null
}

/**
 * Enregistre une facture Stripe en base et tente sa création dans Pennylane.
 * Idempotent via l'index unique sur `stripe_invoice_id`.
 */
export async function syncStripeInvoiceToPennylane(
  supabase: Supabase,
  prestataireId: string,
  invoice: StripeInvoice,
  opts: SyncOptions = {},
): Promise<SyncResult> {

  const montantTtc = invoice.total ?? invoice.amount_paid ?? 0
  const montantTva = invoice.tax ?? 0
  const montantHt = invoice.subtotal ?? montantTtc - montantTva

  const base = {
    prestataire_id: prestataireId,
    numero: invoice.number ?? null,
    date_facture: toIsoDate(invoice.created),
    date_echeance: toIsoDate(invoice.due_date),
    montant_ht_cents: montantHt,
    montant_tva_cents: montantTva,
    montant_ttc_cents: montantTtc,
    devise: (invoice.currency ?? 'eur').toUpperCase(),
    statut: invoice.paid ? 'payee' : (invoice.status ?? 'brouillon'),
    pdf_url: invoice.invoice_pdf ?? invoice.hosted_invoice_url ?? null,
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: typeof invoice.payment_intent === 'string'
      ? invoice.payment_intent
      : null,
    source: 'stripe',
  }

  // 1) Trace locale d'abord (jamais perdue même si Pennylane est indisponible).
  // L'unicité sur stripe_invoice_id est un index PARTIEL : PostgREST ne peut pas
  // l'utiliser pour un ON CONFLICT. On fait donc select → update/insert.
  const { data: existant } = await supabase
    .from('factures_pennylane')
    .select('id, pennylane_invoice_id')
    .eq('stripe_invoice_id', invoice.id)
    .maybeSingle()

  let row: { id: string; pennylane_invoice_id: string | null } | null = existant ?? null
  let upsertError: { message: string } | null = null

  if (existant?.id) {
    const { data, error } = await supabase
      .from('factures_pennylane')
      .update(base)
      .eq('id', existant.id)
      .select('id, pennylane_invoice_id')
      .maybeSingle()
    row = data ?? existant
    upsertError = error
  } else {
    const { data, error } = await supabase
      .from('factures_pennylane')
      .insert(base)
      .select('id, pennylane_invoice_id')
      .maybeSingle()
    row = data ?? null
    upsertError = error
  }

  if (upsertError) {
    console.error('pennylane-sync: upsert local échoué', upsertError)
    return { ok: false, error: upsertError.message }
  }
  if (row?.pennylane_invoice_id) return { ok: true } // déjà poussée

  // 2) Pousse vers Pennylane.
  try {
    const { data: presta } = await supabase
      .from('prestataires')
      .select(
        'id, nom_commercial, raison_sociale, email_contact, adresse, code_postal, ville, siret, tva_intracom',
      )
      .eq('id', prestataireId)
      .maybeSingle()

    if (!presta) throw new Error('Prestataire introuvable')

    let customer: PennylaneCustomer | null
    try {
      customer = await ensurePennylaneCustomer(presta as PrestataireFacturation)
    } catch (err) {
      if (err instanceof PennylaneError) {
        throw new PennylaneError(err.kind, `Client : ${err.message}`, err.status, err.retryAfterSeconds)
      }
      throw err
    }
    if (!customer?.id && !customer?.source_id) throw new Error('Client Pennylane introuvable')

    const lineLabel = invoice.lines?.data?.[0]?.description
      ?? `Abonnement Lesnoces.net ${base.numero ?? ''}`.trim()

    // L'API V2 de création structurée expose POST /customer_invoices.
    // /customer_invoices/import n'existe pas en V2 (404) et l'import de PDF
    // relève d'un autre parcours. Le schéma est strict : ne pas envoyer les
    // anciens champs create_customer / invoice_number.
    let created: PennylaneInvoice
    try {
      created = await pennylaneFetch<PennylaneInvoice>('/customer_invoices', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: customer.id ?? customer.source_id,
          external_reference: invoice.id,
          date: base.date_facture,
          deadline: base.date_echeance ?? base.date_facture,
          currency: base.devise,
          invoice_lines: [
            {
              label: lineLabel,
              quantity: 1,
              unit: 'piece',
              raw_currency_unit_price: (montantHt / 100).toFixed(2),
              vat_rate: montantTva > 0 ? 'FR_200' : 'exempt',
            },
          ],
          ...(opts.extraInvoiceFields ?? {}),
        }),
      })
    } catch (err) {
      if (err instanceof PennylaneError) {
        throw new PennylaneError(err.kind, `Facture : ${err.message}`, err.status, err.retryAfterSeconds)
      }
      throw err
    }

    const pdfUrl = created?.public_file_url ?? created?.file_url ?? base.pdf_url

    await supabase
      .from('factures_pennylane')
      .update({
        pennylane_invoice_id: created?.id ? String(created.id) : null,
        pennylane_customer_id: String(customer.id ?? customer.source_id),
        pdf_url: pdfUrl,
        erreur: null,
        payload: created ?? null,
      })
      .eq('stripe_invoice_id', invoice.id)

    return {
      ok: true,
      customerId: String(customer.id ?? customer.source_id),
      pennylaneInvoiceId: created?.id ? String(created.id) : null,
      numero: created?.invoice_number ?? base.numero ?? null,
      pdfUrl: pdfUrl ?? null,
    }

  } catch (err) {
    const message = err instanceof PennylaneError
      ? `${err.kind}: ${err.message}`
      : err instanceof Error
      ? err.message
      : String(err)
    console.error('pennylane-sync: création facture échouée', message)
    await supabase
      .from('factures_pennylane')
      .update({ erreur: message })
      .eq('stripe_invoice_id', invoice.id)
    return { ok: false, error: message }
  }
}
