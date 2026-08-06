// Client Brevo partagé — point d'appel unique vers l'API Brevo.
// La clé API est lue côté serveur uniquement (secret BREVO_API_KEY).

const BREVO_BASE_URL = 'https://api.brevo.com/v3'

export type BrevoErrorKind =
  | 'missing_key'
  | 'invalid_key'
  | 'forbidden'
  | 'rate_limited'
  | 'unavailable'
  | 'bad_request'

export class BrevoError extends Error {
  kind: BrevoErrorKind
  status: number | null
  retryAfterSeconds: number | null

  constructor(
    kind: BrevoErrorKind,
    message: string,
    status: number | null = null,
    retryAfterSeconds: number | null = null,
  ) {
    super(message)
    this.name = 'BrevoError'
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

export interface BrevoFetchOptions {
  /** Nombre de nouvelles tentatives après l'échec initial. 0 = échec rapide. */
  retries?: number
  /** Timeout par tentative, en millisecondes. */
  timeoutMs?: number
  /** Délai de base du backoff exponentiel, en millisecondes. */
  backoffBaseMs?: number
}

const DEFAULT_OPTIONS: Required<BrevoFetchOptions> = {
  retries: 2,
  timeoutMs: 10_000,
  backoffBaseMs: 500,
}

/** Motifs lisibles en français, réutilisables par l'UI. */
export const BREVO_ERROR_LABELS: Record<BrevoErrorKind, string> = {
  missing_key: "Clé API Brevo absente côté serveur",
  invalid_key: "Clé API Brevo invalide ou révoquée",
  forbidden: "Accès refusé par Brevo (droits insuffisants ou IP non autorisée)",
  rate_limited: "Quota Brevo atteint (trop de requêtes)",
  unavailable: "Brevo momentanément indisponible ou injoignable",
  bad_request: "Requête refusée par Brevo",
}

function isRetryable(kind: BrevoErrorKind): boolean {
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
      const parsed = JSON.parse(text) as { message?: string; code?: string }
      return parsed.message ?? parsed.code ?? text.slice(0, 300)
    } catch {
      return text.slice(0, 300)
    }
  } catch {
    return fallback
  }
}

async function attempt(
  path: string,
  init: RequestInit,
  apiKey: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(`${BREVO_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const aborted = err instanceof Error && err.name === 'AbortError'
    throw new BrevoError(
      'unavailable',
      aborted ? `Timeout après ${timeoutMs} ms` : `Erreur réseau : ${message}`,
    )
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Appel Brevo normalisé.
 * - Par défaut (synchro) : retry avec backoff exponentiel sur rate_limited / unavailable.
 * - Échec rapide (appels interactifs) : passer `{ retries: 0, timeoutMs: 5000 }`.
 * Lève toujours une BrevoError en cas d'échec.
 */
export async function brevoFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  options: BrevoFetchOptions = {},
): Promise<T> {
  const { retries, timeoutMs, backoffBaseMs } = { ...DEFAULT_OPTIONS, ...options }

  const apiKey = Deno.env.get('BREVO_API_KEY')
  if (!apiKey) {
    throw new BrevoError('missing_key', BREVO_ERROR_LABELS.missing_key)
  }

  let lastError: BrevoError | null = null

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await attempt(path, init, apiKey, timeoutMs)

      if (response.ok) {
        const text = await response.text()
        return (text ? JSON.parse(text) : null) as T
      }

      const status = response.status
      const retryAfter = parseRetryAfter(response.headers.get('Retry-After'))
      const detail = await extractMessage(response, `HTTP ${status}`)

      let kind: BrevoErrorKind
      if (status === 401) kind = 'invalid_key'
      else if (status === 403) kind = 'forbidden'
      else if (status === 429) kind = 'rate_limited'
      else if (status >= 500) kind = 'unavailable'
      else kind = 'bad_request'

      lastError = new BrevoError(kind, detail, status, retryAfter)
    } catch (err) {
      lastError = err instanceof BrevoError
        ? err
        : new BrevoError('unavailable', err instanceof Error ? err.message : String(err))
    }

    if (!isRetryable(lastError.kind) || i === retries) break

    const waitMs = lastError.retryAfterSeconds !== null
      ? Math.min(lastError.retryAfterSeconds * 1000, 10_000)
      : backoffBaseMs * 2 ** i
    await new Promise((r) => setTimeout(r, waitMs))
  }

  throw lastError ?? new BrevoError('unavailable', BREVO_ERROR_LABELS.unavailable)
}

export interface BrevoAccount {
  email?: string
  companyName?: string
  firstName?: string
  lastName?: string
  plan?: unknown[]
}

/** Appel de vérification (lecture seule). */
export function getBrevoAccount(options: BrevoFetchOptions = {}): Promise<BrevoAccount> {
  return brevoFetch<BrevoAccount>('/account', { method: 'GET' }, options)
}
