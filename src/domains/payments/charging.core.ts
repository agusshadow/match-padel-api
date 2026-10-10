import { AppError } from '../../types/errors'

// Card #75: who collects a charge and how much the platform keeps. Pure logic
// with its collaborators injected, so it can be checked without a database or
// Mercado Pago. `payment.service.ts` wires the real ones.
// NOT verified against the Mercado Pago sandbox (card #73): docs/mercadopago.md.

export type CollectionMode = 'platform_account' | 'club_account'
export type CollectedVia = 'platform' | 'club'

export interface ClubChargingSettings {
  id: string
  collection_mode: CollectionMode
  commission_percent: number
}

export interface ClubConnection {
  mp_user_id: string
  /** The stored hint (`connected`, `expiring`, `expired`, `revoked`, `error`). */
  status: string
  expires_at: string
}

export const CLUB_PAYMENTS_NOT_ENABLED = 'CLUB_PAYMENTS_NOT_ENABLED'
export const CLUB_PAYMENTS_NOT_ENABLED_MESSAGE =
  'Este club todavía no puede recibir pagos online. Probá de nuevo más tarde o contactá al club.'

// ---- Fee ------------------------------------------------------------------------

/**
 * Marketplace fee of a charge, in currency units with 2 decimals:
 * `round(amount x percent / 100, 2)`, half up, computed in integers (cents and
 * hundredths of a percent) so it never suffers float error. Clamped to the amount.
 */
export function computeMarketplaceFee(amount: number, commissionPercent: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(commissionPercent)) return 0
  if (amount <= 0 || commissionPercent <= 0) return 0
  const cents = Math.round(amount * 100)
  const percentHundredths = Math.round(commissionPercent * 100) // 12.5% -> 1250
  const feeCents = Math.floor((cents * percentHundredths + 5000) / 10000)
  return Math.min(feeCents, cents) / 100
}

/** Pure: amount minus fee, 2 decimals. */
export function computeNetAmount(amount: number, fee: number): number {
  return Math.round(amount * 100 - fee * 100) / 100
}

// ---- Connection usability ---------------------------------------------------------

/** Pure: is the club's link usable to charge at `now`? (`revoked` or past `expires_at` is not.) */
export function isConnectionUsable(connection: ClubConnection | null, now: Date): boolean {
  if (!connection) return false
  if (connection.status === 'revoked') return false
  return new Date(connection.expires_at).getTime() > now.getTime()
}

// ---- Dependencies -------------------------------------------------------------------

export interface ChargingDeps {
  findClubSettings(clubId: string): Promise<ClubChargingSettings | null>
  findConnection(clubId: string): Promise<ClubConnection | null>
  /** The club's token provider (`getClubAccessToken`, card #74). Throws `AppError`. */
  getClubAccessToken(clubId: string): Promise<string>
  platformAccessToken(): string
  /** Are the Mercado Pago OAuth variables set (a link cannot be used without them)? */
  isMpConfigured(): boolean
  now(): Date
}

export interface ClubPaymentsStatus {
  collection_mode: CollectionMode
  payments_enabled: boolean
}

export interface Seller {
  collectedVia: CollectedVia
  clubId: string | null
  accessToken: string
  /** The seller's Mercado Pago user id when known (club account), else null. */
  sellerMpUserId: string | null
  /** Commission applied; null when collected by the platform (no marketplace fee). */
  commissionPercent: number | null
}

const PROVIDER_ERRORS_MAPPED = new Set(['MP_ACCOUNT_NOT_CONNECTED', 'MP_ACCOUNT_EXPIRED', 'MP_NOT_CONFIGURED'])

export function notEnabledError(reason?: string): AppError {
  return new AppError(CLUB_PAYMENTS_NOT_ENABLED_MESSAGE, 409, CLUB_PAYMENTS_NOT_ENABLED, reason ? { reason } : undefined)
}

export function createChargingCore(deps: ChargingDeps) {
  /**
   * Can this club charge online? `platform_account` always can (today's behaviour);
   * `club_account` needs a connected, non-expired link and the OAuth config.
   * Never decrypts a token. An unknown club is treated as `platform_account`.
   */
  async function getClubPaymentsStatus(clubId: string): Promise<ClubPaymentsStatus> {
    const settings = await deps.findClubSettings(clubId)
    if (!settings || settings.collection_mode === 'platform_account') {
      return { collection_mode: 'platform_account', payments_enabled: true }
    }
    const connection = await deps.findConnection(clubId)
    const enabled = deps.isMpConfigured() && isConnectionUsable(connection, deps.now())
    return { collection_mode: 'club_account', payments_enabled: enabled }
  }

  /**
   * Reservation / match creation guard: a paid flow (price > 0) of a
   * `club_account` club with no usable link is 409 CLUB_PAYMENTS_NOT_ENABLED.
   * Free flows and `platform_account` clubs are never affected.
   */
  async function assertClubCanCharge(clubId: string, price: number): Promise<void> {
    if (!(price > 0)) return
    const status = await getClubPaymentsStatus(clubId)
    if (!status.payments_enabled) throw notEnabledError('club_account_not_connected')
  }

  /**
   * Resolves who collects a charge of `amount` for the club. `amount <= 0`
   * (nothing to charge) behaves as before this card: platform token, no fee.
   * Internal-currency purchases never come through here (platform token).
   */
  async function resolveSeller(clubId: string | null, amount: number): Promise<Seller> {
    const platform: Seller = {
      collectedVia: 'platform',
      clubId,
      accessToken: deps.platformAccessToken(),
      sellerMpUserId: null,
      commissionPercent: null,
    }
    if (!clubId || !(amount > 0)) return platform

    const settings = await deps.findClubSettings(clubId)
    if (!settings || settings.collection_mode === 'platform_account') return platform

    let accessToken: string
    try {
      accessToken = await deps.getClubAccessToken(clubId)
    } catch (err) {
      if (err instanceof AppError && PROVIDER_ERRORS_MAPPED.has(err.code ?? '')) {
        throw notEnabledError(err.code)
      }
      throw err
    }
    const connection = await deps.findConnection(clubId)
    return {
      collectedVia: 'club',
      clubId,
      accessToken,
      sellerMpUserId: connection?.mp_user_id ?? null,
      commissionPercent: settings.commission_percent,
    }
  }

  // ---- Webhook ------------------------------------------------------------------

  type WebhookSeller =
    | { kind: 'platform'; accessToken: string }
    | { kind: 'club'; clubId: string; accessToken: string }
    | { kind: 'reject'; reason: 'malformed_club_id' | 'seller_token_unavailable' }

  /**
   * Which token fetches the payment. `club_id` (already validated as a uuid by
   * the controller; `malformed` when it was present but not a uuid) selects the
   * club's seller token; absent means platform-collected. The query alone is
   * never trusted: `validateWebhookPayment` checks it against the payment row.
   */
  async function resolveWebhookSeller(input: {
    clubId: string | undefined
    malformed: boolean
  }): Promise<WebhookSeller> {
    if (input.malformed) return { kind: 'reject', reason: 'malformed_club_id' }
    if (!input.clubId) return { kind: 'platform', accessToken: deps.platformAccessToken() }
    try {
      return { kind: 'club', clubId: input.clubId, accessToken: await deps.getClubAccessToken(input.clubId) }
    } catch {
      return { kind: 'reject', reason: 'seller_token_unavailable' }
    }
  }

  /**
   * Pure: does the payment row agree with the seller that was used? Club
   * notification: the row must be club-collected and belong to that very club.
   * Platform notification (no `club_id`): the row must be platform-collected.
   */
  function validateWebhookPayment(
    seller: { kind: 'platform' } | { kind: 'club'; clubId: string },
    row: { club_id: string | null; collected_via: string | null },
  ): { ok: true } | { ok: false; reason: 'club_mismatch' } {
    const via = row.collected_via ?? 'platform'
    if (seller.kind === 'club') {
      return via === 'club' && row.club_id === seller.clubId ? { ok: true } : { ok: false, reason: 'club_mismatch' }
    }
    return via === 'platform' ? { ok: true } : { ok: false, reason: 'club_mismatch' }
  }

  // ---- Refunds -------------------------------------------------------------------

  /** The token of the account that collected the payment (null `collected_via` = platform). */
  async function resolveRefundToken(row: { club_id: string | null; collected_via: string | null }): Promise<string> {
    if ((row.collected_via ?? 'platform') === 'club') {
      if (!row.club_id) throw new AppError('Club-collected payment without a club', 500, 'INTERNAL_ERROR')
      return deps.getClubAccessToken(row.club_id)
    }
    return deps.platformAccessToken()
  }

  return {
    getClubPaymentsStatus,
    assertClubCanCharge,
    resolveSeller,
    resolveWebhookSeller,
    validateWebhookPayment,
    resolveRefundToken,
  }
}

export type ChargingCore = ReturnType<typeof createChargingCore>
