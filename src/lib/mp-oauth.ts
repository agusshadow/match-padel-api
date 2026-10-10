import { createHash, randomBytes } from 'crypto'
import { z } from 'zod'
import { parseEncryptionKey } from './secret-box'

// Mercado Pago OAuth (Marketplace / Checkout Pro seller link), card #74.
// Written against the public documentation; NOT verified against the MP sandbox
// (card #73 verifies it). Nothing here logs a token, a secret or a response body.

export const MP_AUTHORIZATION_URL = 'https://auth.mercadopago.com/authorization'
export const MP_TOKEN_URL = 'https://api.mercadopago.com/oauth/token'
/** Seller tokens last 180 days per the documentation; used only when the response has no `expires_in`. */
const DEFAULT_EXPIRES_IN_SECONDS = 180 * 24 * 3600
const REQUEST_TIMEOUT_MS = 10_000

export interface MpOAuthConfig {
  appId: string
  appSecret: string
  /** Static URL registered in the MP application; points at the API callback. */
  redirectUri: string
  encryptionKey: Buffer
  /** MP_OAUTH_PKCE=true: send a S256 code_challenge and the code_verifier. Off by default. */
  pkce: boolean
}

/** Null when any required variable is missing (or the key is not 32 bytes of base64). */
export function getMpOAuthConfig(env: NodeJS.ProcessEnv = process.env): MpOAuthConfig | null {
  const appId = env.MP_APP_ID?.trim()
  const appSecret = env.MP_APP_SECRET?.trim()
  const redirectUri = env.MP_OAUTH_REDIRECT_URI?.trim()
  const encryptionKey = parseEncryptionKey(env.MP_TOKEN_ENCRYPTION_KEY)
  if (!appId || !appSecret || !redirectUri || !encryptionKey) return null
  return {
    appId,
    appSecret,
    redirectUri,
    encryptionKey,
    pkce: env.MP_OAUTH_PKCE?.trim().toLowerCase() === 'true',
  }
}

// ---- PKCE ------------------------------------------------------------------

export function generateCodeVerifier(): string {
  return randomBytes(48).toString('base64url') // 64 chars, within the 43..128 range
}

export function codeChallengeS256(verifier: string): string {
  return createHash('sha256').update(verifier, 'utf8').digest('base64url')
}

// ---- Authorization URL -----------------------------------------------------

export function buildAuthorizationUrl(
  config: Pick<MpOAuthConfig, 'appId' | 'redirectUri'>,
  state: string,
  codeChallenge?: string,
): string {
  const params = new URLSearchParams({
    client_id: config.appId,
    response_type: 'code',
    platform_id: 'mp',
    state,
    redirect_uri: config.redirectUri,
  })
  if (codeChallenge) {
    params.set('code_challenge', codeChallenge)
    params.set('code_challenge_method', 'S256')
  }
  return `${MP_AUTHORIZATION_URL}?${params.toString()}`
}

// ---- HTTP ------------------------------------------------------------------

export interface HttpResponse {
  status: number
  body: unknown
}

/** Injectable transport: tests pass a fake, production uses `fetchPostJson`. */
export type HttpPostJson = (url: string, body: Record<string, unknown>) => Promise<HttpResponse>

export const fetchPostJson: HttpPostJson = async (url, body) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    let parsed: unknown = null
    try {
      parsed = await res.json()
    } catch {
      parsed = null
    }
    return { status: res.status, body: parsed }
  } finally {
    clearTimeout(timer)
  }
}

export type MpOAuthErrorKind =
  /** The code or refresh token is no longer valid (expired, used, revoked). Needs a new authorization. */
  | 'invalid_grant'
  /** Another 4xx: wrong credentials/redirect_uri/config. Retrying will not help until fixed. */
  | 'rejected'
  /** Network failure, timeout, 429 or 5xx. Retry later. */
  | 'transient'
  /** 2xx without the expected shape. */
  | 'bad_response'

export class MpOAuthError extends Error {
  constructor(
    public kind: MpOAuthErrorKind,
    public status: number | null,
    /** Short machine code from MP's `error` field, sanitized. Never a token. */
    public mpError: string | null,
  ) {
    super(`mp_oauth_${kind}${status ? ` (status ${status})` : ''}${mpError ? `: ${mpError}` : ''}`)
    this.name = 'MpOAuthError'
  }
}

function sanitizeCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 60)
  return cleaned || null
}

function classifyFailure(status: number, body: unknown): MpOAuthError {
  const mpError = sanitizeCode(body && typeof body === 'object' ? (body as { error?: unknown }).error : null)
  if (status === 429 || status >= 500) return new MpOAuthError('transient', status, mpError)
  if (mpError === 'invalid_grant' || mpError === 'invalid_request' || status === 400 || status === 401) {
    // 400/401 on the token endpoint is how MP answers an expired/used code or a revoked refresh token.
    return new MpOAuthError(mpError === 'invalid_client' ? 'rejected' : 'invalid_grant', status, mpError)
  }
  return new MpOAuthError('rejected', status, mpError)
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive().optional(),
  user_id: z.union([z.number(), z.string()]).optional(),
  public_key: z.string().nullish(),
  scope: z.string().nullish(),
  live_mode: z.boolean().nullish(),
})

export interface MpTokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  /** Null on a refresh response that does not repeat it. */
  mpUserId: string | null
  publicKey: string | null
  scope: string | null
  liveMode: boolean | null
}

export interface MpOAuthClient {
  exchangeCode(code: string, codeVerifier?: string | null): Promise<MpTokenSet>
  refresh(refreshToken: string): Promise<MpTokenSet>
}

export function createMpOAuthClient(
  config: MpOAuthConfig,
  post: HttpPostJson = fetchPostJson,
  now: () => Date = () => new Date(),
): MpOAuthClient {
  async function call(body: Record<string, unknown>): Promise<MpTokenSet> {
    let res: HttpResponse
    try {
      res = await post(MP_TOKEN_URL, body)
    } catch {
      throw new MpOAuthError('transient', null, null)
    }
    if (res.status < 200 || res.status >= 300) throw classifyFailure(res.status, res.body)
    const parsed = tokenResponseSchema.safeParse(res.body)
    if (!parsed.success) throw new MpOAuthError('bad_response', res.status, null)
    const t = parsed.data
    const seconds = t.expires_in ?? DEFAULT_EXPIRES_IN_SECONDS
    return {
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: new Date(now().getTime() + seconds * 1000),
      mpUserId: t.user_id !== undefined ? String(t.user_id) : null,
      publicKey: t.public_key ?? null,
      scope: t.scope ?? null,
      liveMode: t.live_mode ?? null,
    }
  }

  return {
    exchangeCode(code, codeVerifier) {
      return call({
        client_id: config.appId,
        client_secret: config.appSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        test_token: false,
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      })
    },
    refresh(refreshToken) {
      return call({
        client_id: config.appId,
        client_secret: config.appSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      })
    },
  }
}
