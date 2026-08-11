// Client Pennylane partagé — point d'appel unique vers l'API Pennylane v2.
// Le jeton est lu côté serveur uniquement (secret PENNYLANE_API_TOKEN).

const PENNYLANE_BASE_URL = 'https://app.pennylane.com/api/external/v2'

export type PennylaneErrorKind =
  | 'missing_token'
  | 'invalid_token'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'unavailable'
  | 'bad_request'

export class PennylaneError extends Error {
  kind: PennylaneErrorKind
  status: number | null
  retryAfterSeconds: number | null

  constructor(
    kind: PennylaneErrorKind,
    message: string,
    status: number | null = null,
    retryAfterSeconds: number | null = null,
  ) {
    super(message)
    this.name = 'PennylaneError'
    this.kind = kind
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }

  toJSON() {
    return {
      kind: this.kind,
      status: this.status,
      message: this.message,
      retryAfterSeconds: this.retryAfterSeconds,
    }
  }
}

export const PENNYLANE_ERROR_LABELS: Record<PennylaneErrorKind, string> = {
  missing_token: "Jeton API Pennylane absent côté serveur",
  invalid_token: "Jeton API Pennylane invalide ou révoqué",
  forbidden: "Accès refusé par Pennylane (scope manquant sur le jeton)",
  not_found: "Ressource introuvable côté Pennylane",
  rate_limited: "Quota Pennylane atteint (trop de requêtes)",
  unavailable: "Pennylane momentanément indisponible ou injoignable",
  bad_request: "Requête refusée par Pennylane",
}

export interface PennylaneFetchOptions {
  /** Nombre de nouvelles tentatives après l'échec initial. 0 = échec rapide. */
  retries?: number
  /** Timeout par tentative, en millisecondes. */
  timeoutMs?: number
  /** Délai de base du backoff exponentiel, en millisecondes. */
  backoffBaseMs?: number
}

const DEFAULT_OPTIONS: Required<PennylaneFetchOptions> = {
  retries: 2,
  timeoutMs: 15_000,
  backoffBaseMs: 500,
}

function isRetryable(kind: PennylaneErrorKind): boolean {
  return kind === 'rate_limited' || kind === 'unavailable'
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null
  const seconds = Number(header)
  return Number.isFinite(seconds) ? seconds : null
}

async function extractMessage(response: Response, fallback: string): Promise<string> {
  try {
    const text = await response.text()
    if (!text) return fallback
    try {
      const parsed = JSON.parse(text) as {
        message?: string
        error?: string
        errors?: unknown
      }
      if (parsed.message) return parsed.message
      if (parsed.error) return parsed.error
      if (parsed.errors) return JSON.stringify(parsed.errors).slice(0, 400)
      return text.slice(0, 400)
    } catch {
      return text.slice(0, 400)
    }
  } catch {
    return fallback
  }
}

async function attempt(
  path: string,
  init: RequestInit,
  token: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(`${PENNYLANE_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const aborted = err instanceof Error && err.name === 'AbortError'
    throw new PennylaneError(
      'unavailable',
      aborted ? `Timeout après ${timeoutMs} ms` : `Erreur réseau : ${message}`,
    )
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Appel Pennylane normalisé.
 * - Par défaut (synchro) : retry avec backoff exponentiel sur rate_limited / unavailable.
 * - Échec rapide (appels interactifs) : passer `{ retries: 0, timeoutMs: 5000 }`.
 * Lève toujours une PennylaneError en cas d'échec.
 */
export async function pennylaneFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  options: PennylaneFetchOptions = {},
): Promise<T> {
  const { retries, timeoutMs, backoffBaseMs } = { ...DEFAULT_OPTIONS, ...options }

  const token = Deno.env.get('PENNYLANE_API_TOKEN')
  if (!token) {
    throw new PennylaneError('missing_token', PENNYLANE_ERROR_LABELS.missing_token)
  }

  let lastError: PennylaneError | null = null

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await attempt(path, init, token, timeoutMs)

      if (response.ok) {
        const text = await response.text()
        return (text ? JSON.parse(text) : null) as T
      }

      const status = response.status
      const retryAfter = parseRetryAfter(response.headers.get('Retry-After'))
      const detail = await extractMessage(response, `HTTP ${status}`)

      let kind: PennylaneErrorKind
      if (status === 401) kind = 'invalid_token'
      else if (status === 403) kind = 'forbidden'
      else if (status === 404) kind = 'not_found'
      else if (status === 429) kind = 'rate_limited'
      else if (status >= 500) kind = 'unavailable'
      else kind = 'bad_request'

      lastError = new PennylaneError(kind, detail, status, retryAfter)
    } catch (err) {
      lastError = err instanceof PennylaneError
        ? err
        : new PennylaneError('unavailable', err instanceof Error ? err.message : String(err))
    }

    if (!isRetryable(lastError.kind) || i === retries) break

    const waitMs = lastError.retryAfterSeconds !== null
      ? Math.min(lastError.retryAfterSeconds * 1000, 10_000)
      : backoffBaseMs * 2 ** i
    await new Promise((r) => setTimeout(r, waitMs))
  }

  throw lastError ?? new PennylaneError('unavailable', PENNYLANE_ERROR_LABELS.unavailable)
}

// -- Types métier -----------------------------------------------------------

export interface PennylaneCustomer {
  id?: number | string
  source_id?: string
  name?: string
  external_reference?: string
  emails?: string[]
  customer_type?: 'company' | 'individual'
}

export interface PennylaneListResponse<T> {
  items?: T[]
  has_more?: boolean
  next_cursor?: string | null
}

export interface PennylaneInvoice {
  id?: number | string
  invoice_number?: string
  label?: string
  date?: string
  deadline?: string
  currency_amount?: number
  currency_amount_before_tax?: number
  amount?: string | number
  status?: string
  paid?: boolean
  public_file_url?: string
  file_url?: string
  external_reference?: string
}

function encodeFilter(filter: Array<Record<string, unknown>>): string {
  return encodeURIComponent(JSON.stringify(filter))
}

/** Recherche un client par référence externe (id prestataire). */
export async function findCustomerByExternalReference(
  externalReference: string,
  options: PennylaneFetchOptions = {},
): Promise<PennylaneCustomer | null> {
  const filter = encodeFilter([
    { field: 'external_reference', operator: 'eq', value: externalReference },
  ])
  try {
    const res = await pennylaneFetch<PennylaneListResponse<PennylaneCustomer>>(
      `/customers?limit=1&filter=${filter}`,
      { method: 'GET' },
      options,
    )
    return res?.items?.[0] ?? null
  } catch (err) {
    // Pennylane répond 404 lorsqu'aucun client ne correspond à certains
    // filtres, au lieu de renvoyer une collection vide.
    if (err instanceof PennylaneError && err.kind === 'not_found') return null
    throw err
  }
}

/** Recherche un client par email (secours si la référence externe n'existe pas encore). */
export async function findCustomerByEmail(
  email: string,
  options: PennylaneFetchOptions = {},
): Promise<PennylaneCustomer | null> {
  const filter = encodeFilter([
    { field: 'emails', operator: 'in', value: [email] },
  ])
  try {
    const res = await pennylaneFetch<PennylaneListResponse<PennylaneCustomer>>(
      `/customers?limit=1&filter=${filter}`,
      { method: 'GET' },
      options,
    )
    return res?.items?.[0] ?? null
  } catch (err) {
    if (err instanceof PennylaneError && err.kind === 'not_found') return null
    throw err
  }
}

/** Appel de vérification (lecture seule, aucun effet de bord). */
export function pingPennylane(
  options: PennylaneFetchOptions = {},
): Promise<PennylaneListResponse<PennylaneCustomer>> {
  return pennylaneFetch<PennylaneListResponse<PennylaneCustomer>>(
    '/customers?limit=1',
    { method: 'GET' },
    options,
  )
}
