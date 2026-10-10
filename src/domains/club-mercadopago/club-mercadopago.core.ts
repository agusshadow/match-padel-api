import { createHash, randomBytes } from 'crypto'
import { AppError, ConflictError, NotFoundError } from '../../types/errors'
import {
  MpOAuthError,
  buildAuthorizationUrl,
  codeChallengeS256,
  generateCodeVerifier,
} from '../../lib/mp-oauth'
import type { MpOAuthClient, MpOAuthConfig, MpTokenSet } from '../../lib/mp-oauth'
import { SecretBoxError, decryptSecret, encryptSecret } from '../../lib/secret-box'
import type { MpAccountRow, MpAccountStatus, MpStateRow, TokenRotationPatch, UpsertAccountInput } from './club-mercadopago.repository'

// Business logic of the club's Mercado Pago account (card #74). It receives its
// collaborators (repository, HTTP client, audit, mail, clock) so it can be
// checked without a database or the network. `club-mercadopago.service.ts`
// wires the real ones. Never logs or returns a token.

export const STATE_TTL_MINUTES = 10
export const EXPIRING_WINDOW_DAYS = 30
/** On-demand refresh when the access token ends within this many minutes. */
export const ON_DEMAND_REFRESH_MINUTES = 5
/** Same email (expiring) is not repeated more often than this. */
export const NOTIFY_INTERVAL_DAYS = 7
const DAY_MS = 24 * 3_600_000
const PERSIST_ATTEMPTS = 3

export type MpMailTemplate = 'mp_connection_expiring' | 'mp_connection_failed'

export interface StateRepo {
  insertState(input: { stateHash: string; clubId: string; userId: string; codeVerifierEnc: string | null; expiresAt: Date }): Promise<void>
  consumeState(stateHash: string, now: Date): Promise<MpStateRow | null>
  findState(stateHash: string): Promise<MpStateRow | null>
  deleteStatesExpiredBefore(before: Date): Promise<void>
}

export interface AccountRepo {
  findAccount(clubId: string): Promise<MpAccountRow | null>
  upsertAccount(input: UpsertAccountInput): Promise<void>
  rotateTokens(clubId: string, expectedRefreshTokenEnc: string, patch: TokenRotationPatch): Promise<MpAccountRow | null>
  updateAccountHealth(
    clubId: string,
    patch: { status: MpAccountStatus; lastError: string | null; lastNotifiedAt?: Date | null },
  ): Promise<void>
  deleteAccount(clubId: string): Promise<boolean>
  listRefreshCandidates(limit: Date): Promise<MpAccountRow[]>
  findClubStatus(clubId: string): Promise<{ status: string; is_active: boolean } | null>
  isOwnerOrSuperadmin(userId: string, clubId: string): Promise<boolean>
}

export interface MpLogger {
  info(obj: unknown, msg?: string): void
  warn(obj: unknown, msg?: string): void
  error(obj: unknown, msg?: string): void
}

export interface MpDeps {
  repo: StateRepo & AccountRepo
  getConfig: () => MpOAuthConfig | null
  createClient: (config: MpOAuthConfig) => MpOAuthClient
  audit: (input: {
    actorId: string | null
    clubId: string
    action: string
    entity: string
    entityId: string
    metadata: Record<string, unknown>
  }) => Promise<void>
  /** Fire-and-forget email to the club owners; must never throw. */
  notify: (input: { clubId: string; template: MpMailTemplate; daysLeft: number | null; reason: string | null }) => Promise<void>
  /** Base URL of the club panel (CLUB_PANEL_URL or its default). */
  panelUrl: () => string
  now: () => Date
  logger: MpLogger
}

// ---- Pure helpers -------------------------------------------------------------

export function hashState(state: string): string {
  return createHash('sha256').update(state, 'utf8').digest('hex')
}

export function generateState(): string {
  return randomBytes(32).toString('base64url')
}

export function daysLeft(expiresAt: string | Date, now: Date): number {
  const ms = new Date(expiresAt).getTime() - now.getTime()
  return Math.max(0, Math.ceil(ms / DAY_MS))
}

/** Stored status is a hint; time and the last known failure decide what the panel sees. */
export function deriveStatus(
  stored: MpAccountStatus,
  expiresAt: string | Date,
  now: Date,
): MpAccountStatus {
  if (stored === 'revoked') return 'revoked'
  if (new Date(expiresAt).getTime() <= now.getTime()) return 'expired'
  if (stored === 'error') return 'error'
  return daysLeft(expiresAt, now) <= EXPIRING_WINDOW_DAYS ? 'expiring' : 'connected'
}

/**
 * Which email (if any) a failed renewal triggers. `failed` once when the link
 * becomes unusable; `expiring` (still valid, renewal failed) at most weekly.
 */
export function decideNotification(input: {
  previousStatus: MpAccountStatus
  newStatus: MpAccountStatus
  lastNotifiedAt: string | null
  now: Date
}): MpMailTemplate | null {
  const { previousStatus, newStatus, lastNotifiedAt, now } = input
  if (newStatus === 'expired' || newStatus === 'revoked') {
    const alreadyBroken = previousStatus === 'expired' || previousStatus === 'revoked'
    return alreadyBroken && lastNotifiedAt ? null : 'mp_connection_failed'
  }
  if (newStatus === 'error') {
    const recent = lastNotifiedAt && now.getTime() - new Date(lastNotifiedAt).getTime() < NOTIFY_INTERVAL_DAYS * DAY_MS
    return recent ? null : 'mp_connection_expiring'
  }
  return null
}

export interface MpAccountSummary {
  connected: boolean
  status: MpAccountStatus | null
  mp_user_id: string | null
  expires_at: string | null
  days_left: number | null
  live_mode: boolean | null
  last_refresh_at: string | null
  last_error: string | null
}

export type CallbackFailureReason =
  | 'access_denied'
  | 'invalid_request'
  | 'invalid_state'
  | 'state_expired'
  | 'state_used'
  | 'club_not_available'
  | 'not_owner'
  | 'exchange_failed'
  | 'storage_failed'

export type RefreshOutcome =
  | { ok: true; account: MpAccountRow }
  | { ok: false; status: MpAccountStatus; reason: string }

function mpNotConfigured(): AppError {
  return new AppError('Mercado Pago is not configured in this environment', 503, 'MP_NOT_CONFIGURED')
}

/** Short, secret-free description of a failure, safe to store in `last_error` and to log. */
function describeFailure(err: unknown): string {
  if (err instanceof MpOAuthError) return err.message.slice(0, 200)
  if (err instanceof SecretBoxError) return 'token_decryption_failed'
  return 'unexpected_error'
}

const accessAad = (clubId: string) => `${clubId}:access`
const refreshAad = (clubId: string) => `${clubId}:refresh`
const verifierAad = (stateHash: string) => `state:${stateHash}`

export function createMercadoPagoCore(deps: MpDeps) {
  const { repo, logger } = deps
  const inFlight = new Map<string, Promise<RefreshOutcome>>()

  function requireConfig(): MpOAuthConfig {
    const config = deps.getConfig()
    if (!config) throw mpNotConfigured()
    return config
  }

  function redirectUrl(clubId: string | null, status: 'connected' | 'error', reason?: CallbackFailureReason): string {
    const base = deps.panelUrl().replace(/\/+$/, '')
    const path = clubId ? `/${encodeURIComponent(clubId)}/mercadopago` : '/mercadopago'
    const query = new URLSearchParams({ status })
    if (reason) query.set('reason', reason)
    return `${base}${path}?${query.toString()}`
  }

  // ---- Connect ----------------------------------------------------------------

  async function startConnect(clubId: string, userId: string): Promise<{ authorization_url: string }> {
    const config = requireConfig()
    const club = await repo.findClubStatus(clubId)
    if (!club) throw new NotFoundError('Club')
    if (club.status !== 'approved') {
      throw new ConflictError('The club must be approved before linking a Mercado Pago account')
    }

    const now = deps.now()
    const state = generateState()
    const stateHash = hashState(state)
    let challenge: string | undefined
    let verifierEnc: string | null = null
    if (config.pkce) {
      const verifier = generateCodeVerifier()
      challenge = codeChallengeS256(verifier)
      verifierEnc = encryptSecret(verifier, config.encryptionKey, verifierAad(stateHash))
    }

    await repo.insertState({
      stateHash,
      clubId,
      userId,
      codeVerifierEnc: verifierEnc,
      expiresAt: new Date(now.getTime() + STATE_TTL_MINUTES * 60_000),
    })
    // Housekeeping: states are useless a day after they expired.
    repo.deleteStatesExpiredBefore(new Date(now.getTime() - DAY_MS)).catch((err) => {
      logger.warn({ err: describeFailure(err) }, '[mp] could not purge old oauth states')
    })

    return { authorization_url: buildAuthorizationUrl(config, state, challenge) }
  }

  // ---- Callback ---------------------------------------------------------------

  /** Returns where to redirect the browser. Business failures are redirects, never JSON errors. */
  async function completeCallback(
    query: { code?: string; state?: string; error?: string } | null,
  ): Promise<{ redirectTo: string }> {
    const config = requireConfig()
    const now = deps.now()

    if (!query || !query.state) {
      return { redirectTo: redirectUrl(null, 'error', 'invalid_request') }
    }
    const stateHash = hashState(query.state)

    const state = await repo.consumeState(stateHash, now)
    if (!state) {
      const existing = await repo.findState(stateHash)
      const reason: CallbackFailureReason = !existing ? 'invalid_state' : existing.used_at ? 'state_used' : 'state_expired'
      return { redirectTo: redirectUrl(existing?.club_id ?? null, 'error', reason) }
    }
    const clubId = state.club_id
    const fail = (reason: CallbackFailureReason) => ({ redirectTo: redirectUrl(clubId, 'error', reason) })

    if (query.error) return fail(query.error === 'access_denied' ? 'access_denied' : 'invalid_request')
    if (!query.code) return fail('invalid_request')

    const club = await repo.findClubStatus(clubId)
    if (!club || club.status !== 'approved') return fail('club_not_available')
    if (!(await repo.isOwnerOrSuperadmin(state.user_id, clubId))) return fail('not_owner')

    let tokens: MpTokenSet
    try {
      const verifier = state.code_verifier_enc
        ? decryptSecret(state.code_verifier_enc, config.encryptionKey, verifierAad(stateHash))
        : null
      tokens = await deps.createClient(config).exchangeCode(query.code, verifier)
    } catch (err) {
      logger.warn({ clubId, error: describeFailure(err) }, '[mp] authorization code exchange failed')
      return fail('exchange_failed')
    }
    if (!tokens.mpUserId) {
      logger.warn({ clubId }, '[mp] token response had no user_id')
      return fail('exchange_failed')
    }

    const previous = await repo.findAccount(clubId).catch(() => null)
    try {
      await repo.upsertAccount({
        clubId,
        mpUserId: tokens.mpUserId,
        accessTokenEnc: encryptSecret(tokens.accessToken, config.encryptionKey, accessAad(clubId)),
        refreshTokenEnc: encryptSecret(tokens.refreshToken, config.encryptionKey, refreshAad(clubId)),
        publicKey: tokens.publicKey,
        scope: tokens.scope,
        expiresAt: tokens.expiresAt,
        liveMode: tokens.liveMode,
        connectedBy: state.user_id,
        now,
      })
    } catch (err) {
      logger.error({ clubId, error: describeFailure(err) }, '[mp] could not store the linked account')
      return fail('storage_failed')
    }

    await deps.audit({
      actorId: state.user_id,
      clubId,
      action: 'club.mp_connected',
      entity: 'club_mp_account',
      entityId: clubId,
      metadata: {
        mp_user_id: tokens.mpUserId,
        live_mode: tokens.liveMode,
        expires_at: tokens.expiresAt.toISOString(),
        relinked: Boolean(previous),
        previous_mp_user_id: previous?.mp_user_id ?? null,
      },
    })
    return { redirectTo: redirectUrl(clubId, 'connected') }
  }

  // ---- Status / disconnect -----------------------------------------------------

  async function getStatus(clubId: string): Promise<MpAccountSummary> {
    requireConfig()
    const row = await repo.findAccount(clubId)
    if (!row) {
      return {
        connected: false,
        status: null,
        mp_user_id: null,
        expires_at: null,
        days_left: null,
        live_mode: null,
        last_refresh_at: null,
        last_error: null,
      }
    }
    const now = deps.now()
    const status = deriveStatus(row.status, row.expires_at, now)
    return {
      connected: status !== 'expired' && status !== 'revoked',
      status,
      mp_user_id: row.mp_user_id,
      expires_at: row.expires_at,
      days_left: daysLeft(row.expires_at, now),
      live_mode: row.live_mode,
      last_refresh_at: row.last_refresh_at,
      last_error: row.last_error,
    }
  }

  async function disconnect(clubId: string, actorId: string): Promise<{ disconnected: true; was_connected: boolean }> {
    requireConfig()
    const previous = await repo.findAccount(clubId)
    const removed = await repo.deleteAccount(clubId)
    if (removed) {
      await deps.audit({
        actorId,
        clubId,
        action: 'club.mp_disconnected',
        entity: 'club_mp_account',
        entityId: clubId,
        metadata: { mp_user_id: previous?.mp_user_id ?? null, status: previous?.status ?? null },
      })
    }
    return { disconnected: true, was_connected: removed }
  }

  // ---- Renewal -----------------------------------------------------------------

  async function doRefresh(clubId: string): Promise<RefreshOutcome> {
    const config = requireConfig()
    const row = await repo.findAccount(clubId)
    if (!row) throw new AppError('The club has no Mercado Pago account linked', 409, 'MP_ACCOUNT_NOT_CONNECTED')
    const now = deps.now()

    let tokens: MpTokenSet
    try {
      const refreshToken = decryptSecret(row.refresh_token_enc, config.encryptionKey, refreshAad(clubId))
      tokens = await deps.createClient(config).refresh(refreshToken)
    } catch (err) {
      const reason = describeFailure(err)
      const lapsed = new Date(row.expires_at).getTime() <= now.getTime()
      let status: MpAccountStatus
      if (err instanceof MpOAuthError && err.kind === 'invalid_grant') status = lapsed ? 'expired' : 'revoked'
      else status = lapsed ? 'expired' : 'error'

      const template = decideNotification({
        previousStatus: row.status,
        newStatus: status,
        lastNotifiedAt: row.last_notified_at,
        now,
      })
      try {
        await repo.updateAccountHealth(clubId, {
          status,
          lastError: reason,
          ...(template ? { lastNotifiedAt: now } : {}),
        })
      } catch (persistErr) {
        logger.error({ clubId, error: describeFailure(persistErr) }, '[mp] could not record the renewal failure')
      }
      logger.warn({ clubId, status, error: reason }, '[mp] token renewal failed')
      if (template) {
        void deps
          .notify({ clubId, template, daysLeft: daysLeft(row.expires_at, now), reason })
          .catch(() => undefined)
      }
      return { ok: false, status, reason }
    }

    const patch: TokenRotationPatch = {
      accessTokenEnc: encryptSecret(tokens.accessToken, config.encryptionKey, accessAad(clubId)),
      refreshTokenEnc: encryptSecret(tokens.refreshToken, config.encryptionKey, refreshAad(clubId)),
      expiresAt: tokens.expiresAt,
      mpUserId: tokens.mpUserId,
      publicKey: tokens.publicKey,
      scope: tokens.scope,
      liveMode: tokens.liveMode,
      now,
    }

    // The refresh token rotated: if this write is lost the club's link is broken,
    // so it is retried before giving up.
    let lastErr: unknown = null
    for (let attempt = 1; attempt <= PERSIST_ATTEMPTS; attempt++) {
      try {
        const updated = await repo.rotateTokens(clubId, row.refresh_token_enc, patch)
        if (updated) {
          logger.info({ clubId, expiresAt: updated.expires_at }, '[mp] token renewed')
          return { ok: true, account: updated }
        }
        // Another instance rotated first: keep its pair, do not overwrite it with ours.
        const current = await repo.findAccount(clubId)
        if (current) return { ok: true, account: current }
        throw new AppError('The club has no Mercado Pago account linked', 409, 'MP_ACCOUNT_NOT_CONNECTED')
      } catch (err) {
        if (err instanceof AppError) throw err
        lastErr = err
      }
    }
    logger.error(
      { clubId, error: describeFailure(lastErr) },
      '[mp] CRITICAL: refreshed tokens could not be stored; the club must link the account again',
    )
    return { ok: false, status: 'error', reason: 'token_persist_failed' }
  }

  /** Single-flight per club: concurrent callers (job, charges) share one renewal. */
  function refreshAccount(clubId: string): Promise<RefreshOutcome> {
    const running = inFlight.get(clubId)
    if (running) return running
    const promise = doRefresh(clubId).finally(() => {
      inFlight.delete(clubId)
    })
    inFlight.set(clubId, promise)
    return promise
  }

  async function refreshExpiringAccounts(): Promise<{ checked: number; refreshed: number; failed: number }> {
    if (!deps.getConfig()) {
      logger.info({}, '[mp] renewal skipped: Mercado Pago is not configured')
      return { checked: 0, refreshed: 0, failed: 0 }
    }
    const now = deps.now()
    const candidates = await repo.listRefreshCandidates(new Date(now.getTime() + EXPIRING_WINDOW_DAYS * DAY_MS))
    let refreshed = 0
    let failed = 0
    for (const account of candidates) {
      try {
        const outcome = await refreshAccount(account.club_id)
        if (outcome.ok) refreshed++
        else failed++
      } catch (err) {
        failed++
        logger.error({ clubId: account.club_id, error: describeFailure(err) }, '[mp] renewal crashed')
      }
    }
    return { checked: candidates.length, refreshed, failed }
  }

  // ---- Token provider (used by the charging flows, card #75) -------------------

  async function getClubAccessToken(clubId: string): Promise<string> {
    const config = requireConfig()
    const now = deps.now()
    let row = await repo.findAccount(clubId)
    if (!row) throw new AppError('The club has no Mercado Pago account linked', 409, 'MP_ACCOUNT_NOT_CONNECTED')

    const expired = (r: MpAccountRow) =>
      r.status === 'revoked' || new Date(r.expires_at).getTime() <= now.getTime()
    const expiredError = (r: MpAccountRow) =>
      new AppError(
        'The Mercado Pago link of the club expired or was revoked; the owner must link the account again',
        409,
        'MP_ACCOUNT_EXPIRED',
        { reason: r.status === 'revoked' ? 'revoked' : 'expired' },
      )

    if (expired(row)) {
      if (row.status !== 'revoked' && row.status !== 'expired') {
        await repo.updateAccountHealth(clubId, { status: 'expired', lastError: row.last_error }).catch(() => undefined)
      }
      throw expiredError(row)
    }

    const msLeft = new Date(row.expires_at).getTime() - now.getTime()
    if (msLeft <= ON_DEMAND_REFRESH_MINUTES * 60_000) {
      const outcome = await refreshAccount(clubId)
      if (outcome.ok) row = outcome.account
      // A failed renewal with the current token still valid falls through to use it.
    }

    try {
      return decryptSecret(row.access_token_enc, config.encryptionKey, accessAad(clubId))
    } catch (err) {
      logger.error({ clubId, error: describeFailure(err) }, '[mp] stored access token could not be decrypted')
      throw new AppError('The stored Mercado Pago credentials are unreadable', 500, 'MP_TOKEN_UNREADABLE')
    }
  }

  return {
    startConnect,
    completeCallback,
    getStatus,
    disconnect,
    refreshAccount,
    refreshExpiringAccounts,
    getClubAccessToken,
  }
}

export type MercadoPagoCore = ReturnType<typeof createMercadoPagoCore>
