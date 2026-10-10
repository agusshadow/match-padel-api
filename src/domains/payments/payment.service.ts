import crypto from 'crypto'
import { supabase } from '../../lib/supabase'
import { createMpChargeClient, getPlatformAccessToken, type MpPreferenceBody } from '../../lib/mercadopago'
import { getMpOAuthConfig } from '../../lib/mp-oauth'
import { logger } from '../../lib/logger'
import { matchRepository } from '../matches/match.repository'
import * as reservationRepository from '../reservations/reservation.repository'
import { notifications } from '../notifications/notification.service'
import { NotFoundError, ForbiddenError, AppError, ConflictError } from '../../types/errors'
import { getClubAccessToken } from '../club-mercadopago/club-mercadopago.service'
import * as mpAccountRepository from '../club-mercadopago/club-mercadopago.repository'
import {
  computeMarketplaceFee,
  computeNetAmount,
  createChargingCore,
  type ClubPaymentsStatus,
} from './charging.core'
import * as paymentRepository from './payment.repository'
import {
  createRefundPolicyCore,
  type PolicyRefundPayment,
  type PolicyRefundSummary,
  type AttemptRefundResult,
} from './refund-policy.core'
import { resolveEffectivePolicy } from './refund-policy.service'
import { notifyRefundPending } from '../mail/mail.service'
import { tournamentRepository } from '../tournaments/tournament.repository'
import {
  createConfirmationCore,
  type PaymentInit,
  type TeamRecord,
  type TournamentRecord,
} from '../tournaments/tournament.core'

const APP_URL = process.env.APP_URL ?? 'https://match-padel-web.vercel.app'
const API_URL = process.env.API_URL ?? 'https://match-padel-api.railway.app'
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET ?? ''

// Card #75: seller resolution, fee and webhook/refund token selection (logic in
// charging.core.ts, wired here to the real repository and token provider).
const charging = createChargingCore({
  findClubSettings: paymentRepository.findClubChargingSettings,
  findConnection: async (clubId) => {
    const [row] = await mpAccountRepository.findConnectionSummaries([clubId])
    return row ? { mp_user_id: row.mp_user_id, status: row.status, expires_at: row.expires_at } : null
  },
  getClubAccessToken,
  platformAccessToken: getPlatformAccessToken,
  isMpConfigured: () => getMpOAuthConfig() !== null,
  now: () => new Date(),
})

/** `payments_enabled` of a club for the availability responses (never decrypts a token). */
export async function getClubPaymentsStatus(clubId: string): Promise<ClubPaymentsStatus> {
  return charging.getClubPaymentsStatus(clubId)
}

/** 409 CLUB_PAYMENTS_NOT_ENABLED for a paid flow of a club_account club with no usable link. */
export async function assertClubCanCharge(clubId: string, price: number): Promise<void> {
  return charging.assertClubCanCharge(clubId, price)
}

export interface PreferenceResult {
  preference_id: string
  init_point: string
  sandbox_init_point: string
}

// Shared by both the single-payer reservation flow and the per-player match
// split payments: inserts the `payments` row first so its id can be used as
// the MercadoPago `external_reference` — the webhook then resolves the exact
// row unambiguously, whether a reservation has one payer or four.
// Card #77: a tournament registration fee is the same charge with a
// `tournament` target instead of a reservation (reservation_id stays null).
interface TournamentChargeTarget {
  tournamentId: string
  tournamentTeamId: string
}

async function createPreferenceForPayment(
  reservationId: string | null,
  userId: string,
  amount: number,
  title: string,
  clubId: string | null,
  tournament?: TournamentChargeTarget,
): Promise<PreferenceResult & { payment_id: string }> {
  // Card #75: who collects. Resolved BEFORE inserting the row so a club that
  // cannot charge (409 CLUB_PAYMENTS_NOT_ENABLED) leaves nothing behind.
  const seller = await charging.resolveSeller(clubId, amount)
  const byClub = seller.collectedVia === 'club'
  const marketplaceFee = byClub ? computeMarketplaceFee(amount, seller.commissionPercent ?? 0) : 0

  const { data: paymentRow, error: insertErr } = await supabase
    .from('payments')
    .insert({
      reservation_id: reservationId,
      tournament_id: tournament?.tournamentId ?? null,
      tournament_team_id: tournament?.tournamentTeamId ?? null,
      user_id: userId,
      amount,
      currency: 'ARS',
      status: 'pending',
      club_id: clubId,
      collected_via: seller.collectedVia,
      seller_mp_user_id: seller.sellerMpUserId,
      commission_percent: seller.commissionPercent,
      marketplace_fee: marketplaceFee,
      net_amount: computeNetAmount(amount, marketplaceFee),
    })
    .select('id')
    .single()

  if (insertErr) throw insertErr

  // The club travels in the notification URL so the webhook knows whose token
  // to fetch the payment with; the webhook re-validates it against the row.
  const notificationUrl = byClub
    ? `${API_URL}/api/v1/payments/webhook?club_id=${seller.clubId}`
    : `${API_URL}/api/v1/payments/webhook`

  const backUrlBase = tournament
    ? `${APP_URL}/tournaments/${tournament.tournamentId}`
    : `${APP_URL}/reservations/${reservationId}`

  let pref
  try {
    const body: MpPreferenceBody = {
      items: [
        {
          id: paymentRow.id,
          title,
          quantity: 1,
          unit_price: amount,
          currency_id: 'ARS',
        },
      ],
      external_reference: paymentRow.id,
      back_urls: {
        success: `${backUrlBase}?payment=success`,
        failure: `${backUrlBase}?payment=failure`,
        pending: `${backUrlBase}?payment=pending`,
      },
      auto_return: 'approved',
      notification_url: notificationUrl,
      // Omitted at 0% (platform-collected or commission 0): MP may reject a zero fee.
      ...(marketplaceFee > 0 ? { marketplace_fee: marketplaceFee } : {}),
    }
    pref = await createMpChargeClient(seller.accessToken).createPreference(body)
  } catch (err) {
    // Don't leave an orphaned pending payment row behind if MercadoPago rejects the preference.
    await supabase.from('payments').delete().eq('id', paymentRow.id)
    throw err
  }

  const result: PreferenceResult = {
    preference_id: pref.id!,
    init_point: pref.init_point!,
    sandbox_init_point: pref.sandbox_init_point!,
  }

  await supabase
    .from('payments')
    .update({ metadata: result })
    .eq('id', paymentRow.id)

  return { ...result, payment_id: paymentRow.id as string }
}

/**
 * Card #77: the registration fee of a tournament team, charged through the
 * club's per-club charging abstraction (`resolveSeller`: club token and
 * `marketplace_fee` for a `club_account` club). The amount is the tournament's
 * `entry_fee` as the server read it, never a client value. NOT verified against
 * the Mercado Pago sandbox (card #73).
 */
export async function createTournamentRegistrationPayment(input: {
  tournament: TournamentRecord
  team: TeamRecord
  payerId: string
  amount: number
}): Promise<PaymentInit> {
  const result = await createPreferenceForPayment(
    null,
    input.payerId,
    input.amount,
    `Inscripción – ${input.tournament.name}`,
    input.tournament.club_id,
    { tournamentId: input.tournament.id, tournamentTeamId: input.team.id },
  )
  return {
    payment_id: result.payment_id,
    preference_id: result.preference_id,
    init_point: result.init_point,
    sandbox_init_point: result.sandbox_init_point,
    amount: input.amount,
  }
}

export async function createPaymentPreference(
  reservationId: string,
  userId: string,
) {
  const { data: reservation, error } = await supabase
    .from('court_reservations')
    .select(`
      id, user_id, club_id, total_price, status,
      court:courts(name, club:clubs(name))
    `)
    .eq('id', reservationId)
    .single()

  if (error || !reservation) throw new NotFoundError('Reservation')
  if (reservation.user_id !== userId) throw new ForbiddenError('Not your reservation')
  if (reservation.status !== 'pending') {
    throw new AppError('Reservation is not in pending status', 400, 'INVALID_STATUS')
  }

  const court = reservation.court as unknown as Record<string, unknown> | null
  const courtName = (court?.name as string) ?? 'Cancha'
  const clubName = ((court?.club as Record<string, unknown>)?.name as string) ?? 'Club'

  const { payment_id: _paymentId, ...preference } = await createPreferenceForPayment(
    reservationId,
    userId,
    Number(reservation.total_price),
    `Reserva – ${courtName} en ${clubName}`,
    (reservation.club_id as string | null) ?? null,
  )
  return preference
}

// Card #57: a match's court is split 4 ways. A player only becomes a
// match_players row once their share is actually confirmed by the webhook —
// this just validates the slot and hands back a checkout link for it.
//
// Known limitation: the "is there still a spot" check below (confirmedCount
// < 4) only counts already-confirmed players, not other pending checkouts in
// flight. Two players racing for the last spot could both get a valid
// checkout link; only the first to actually pay ends up seated in
// match_players (see confirmMatchPayment's own guard), the second's payment
// is approved by MercadoPago but left unseated with no automatic refund. Not
// fixed here — same "document, don't over-engineer a lock for a rare race"
// call as card #26.
export async function createMatchPaymentPreference(matchId: string, userId: string) {
  const match = await matchRepository.findById(matchId)
  if (!match) throw new NotFoundError('Match')
  if (match.status !== 'waiting') {
    throw new ConflictError('This match is not accepting players')
  }

  const alreadyPlayer = await matchRepository.isPlayer(matchId, userId)
  if (alreadyPlayer) throw new ConflictError('Already joined this match')

  const confirmedCount = await matchRepository.countPlayers(matchId)
  if (confirmedCount >= 4) throw new ConflictError('Match is full')

  const reservation = await reservationRepository.findById(match.reservation_id)
  if (!reservation) throw new NotFoundError('Reservation')

  const share = Math.round((Number(reservation.total_price) / 4) * 100) / 100

  const { payment_id: _paymentId, ...preference } = await createPreferenceForPayment(
    match.reservation_id,
    userId,
    share,
    `Partido – ${reservation.court.name} en ${reservation.court.club.name} (1/4)`,
    reservation.club_id ?? null,
  )
  return preference
}

// Card #63: the one currency top-up pack for now (a fixed rate — 1 currency
// unit = $5 ARS — also used to convert the late-cancellation partial credit
// in match.service.ts). Multiple tiers would be a natural follow-up, not
// built here to keep this card's scope tight.
export const CURRENCY_PACK = { amountArs: 500, currencyAmount: 100 }

// Real-money top-up of the internal currency — kept in its own table
// (currency_purchases) rather than the reservation-shaped `payments` table.
// The webhook below tells the two apart by a 'currency:' prefix on
// external_reference.
export async function createCurrencyPreference(userId: string): Promise<PreferenceResult> {
  const { data: purchaseRow, error: insertErr } = await supabase
    .from('currency_purchases')
    .insert({
      user_id: userId,
      amount_ars: CURRENCY_PACK.amountArs,
      currency_amount: CURRENCY_PACK.currencyAmount,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertErr) throw insertErr

  let pref
  try {
    // Card #75: internal-currency purchases ALWAYS go to the platform's own
    // account: platform token, no marketplace fee, no club in the notification URL.
    pref = await createMpChargeClient(getPlatformAccessToken()).createPreference({
      items: [
        {
          id: purchaseRow.id,
          title: `${CURRENCY_PACK.currencyAmount} monedas`,
          quantity: 1,
          unit_price: CURRENCY_PACK.amountArs,
          currency_id: 'ARS',
        },
      ],
      external_reference: `currency:${purchaseRow.id}`,
      back_urls: {
        success: `${APP_URL}/marketplace?payment=success`,
        failure: `${APP_URL}/marketplace?payment=failure`,
        pending: `${APP_URL}/marketplace?payment=pending`,
      },
      auto_return: 'approved',
      notification_url: `${API_URL}/api/v1/payments/webhook`,
    })
  } catch (err) {
    await supabase.from('currency_purchases').delete().eq('id', purchaseRow.id)
    throw err
  }

  const result: PreferenceResult = {
    preference_id: pref.id!,
    init_point: pref.init_point!,
    sandbox_init_point: pref.sandbox_init_point!,
  }

  await supabase.from('currency_purchases').update({ metadata: result }).eq('id', purchaseRow.id)

  return result
}

export class WebhookSignatureError extends AppError {
  constructor(message = 'Invalid webhook signature') {
    super(message, 401, 'INVALID_SIGNATURE')
  }
}

/**
 * Verifies the `x-signature` header per MercadoPago's HMAC-SHA256 scheme.
 * Manifest format: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * Ref: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 */
export function verifyWebhookSignature(
  xSignature: string | undefined,
  xRequestId: string | undefined,
  dataId: string | undefined,
): boolean {
  if (!MP_WEBHOOK_SECRET) {
    // No secret configured yet (e.g. webhook not set up in the MP panel) — fail closed.
    logger.error({}, 'MP_WEBHOOK_SECRET is not configured; rejecting webhook')
    return false
  }
  if (!xSignature || !dataId) return false

  const parts = Object.fromEntries(
    xSignature.split(',').map((part) => {
      const [key, value] = part.split('=')
      return [key?.trim(), value?.trim()]
    }),
  )
  const ts = parts.ts
  const hash = parts.v1
  if (!ts || !hash) return false

  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId ?? ''};ts:${ts};`
  const expectedHash = crypto
    .createHmac('sha256', MP_WEBHOOK_SECRET)
    .update(manifest)
    .digest('hex')

  if (expectedHash.length !== hash.length) return false
  return crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(hash))
}

// Auto-balances a new confirmed player onto whichever team has fewer players.
async function addConfirmedPlayer(matchId: string, userId: string): Promise<void> {
  const players = await matchRepository.getPlayers(matchId)
  const team1Count = players.filter((p: any) => p.team === 1).length
  const team2Count = players.filter((p: any) => p.team === 2).length
  const team = team1Count <= team2Count ? 1 : 2
  await matchRepository.join(matchId, userId, team)
}

async function confirmMatchPayment(reservationId: string, userId: string): Promise<void> {
  const { data: match } = await supabase
    .from('matches')
    .select('id, status')
    .eq('reservation_id', reservationId)
    .maybeSingle()

  if (!match) {
    // Plain reservation (not tied to a match) — a single approved payment fully pays for it.
    await reservationRepository.updateStatus(reservationId, 'confirmed')
    return
  }

  const alreadyPlayer = await matchRepository.isPlayer(match.id, userId)
  if (!alreadyPlayer) {
    // Guard against the known race in createMatchPaymentPreference: two players
    // could both get a valid checkout link for the "last" spot. Whoever's
    // payment is confirmed first fills it; a second approved payment past 4
    // players is left approved-but-unseated rather than corrupting the match
    // with a 5th player — it needs a manual refund, same documented gap.
    const countBeforeInsert = await matchRepository.countPlayers(match.id)
    if (countBeforeInsert < 4) {
      await addConfirmedPlayer(match.id, userId)
    } else {
      logger.error(
        { matchId: match.id, userId },
        'Payment confirmed for a match that already has 4 players — not seated, needs manual refund',
      )
    }
  }

  const confirmedCount = await matchRepository.countPlayers(match.id)
  if (confirmedCount >= 4 && match.status === 'waiting') {
    await matchRepository.updateStatus(match.id, 'in_progress')
    await reservationRepository.updateStatus(reservationId, 'confirmed')

    const players = await matchRepository.getPlayers(match.id)
    const playerIds = players.map((p: any) => p.user_id)
    notifications.matchStarted(playerIds, match.id).catch((err) =>
      logger.error(err, 'Failed to send matchStarted notification'),
    )
  }
}

// Card #63: confirms (or rejects) a currency top-up. Mirrors handleWebhook's
// idempotency/amount-check logic but against currency_purchases instead of
// payments — kept separate rather than shoehorning a third shape into that
// function's branching.
async function handleCurrencyWebhook(
  purchaseId: string,
  eventId: string,
  mpPaymentId: string,
  mpStatus: string,
  mpAmount: number,
) {
  const { data: purchase } = await supabase
    .from('currency_purchases')
    .select('id, user_id, amount_ars, currency_amount, mp_event_id')
    .eq('id', purchaseId)
    .maybeSingle()

  if (!purchase) {
    logger.error({ purchaseId }, 'Webhook received for unknown currency purchase')
    return { handled: false }
  }

  if (purchase.mp_event_id === eventId) {
    return { handled: true, status: mpStatus, deduped: true }
  }

  const expectedAmount = Number(purchase.amount_ars)
  if (Math.abs(mpAmount - expectedAmount) > 0.01) {
    logger.error(
      { purchaseId, mpAmount, expectedAmount },
      'MercadoPago currency webhook amount mismatch — refusing to credit',
    )
    return { handled: false, reason: 'amount_mismatch' }
  }

  const status =
    mpStatus === 'approved' ? 'approved' :
    mpStatus === 'rejected' ? 'rejected' :
    mpStatus === 'cancelled' ? 'cancelled' :
    'pending'

  await supabase
    .from('currency_purchases')
    .update({ status, mp_payment_id: mpPaymentId, mp_event_id: eventId })
    .eq('id', purchaseId)
    .eq('status', 'pending')

  if (mpStatus === 'approved') {
    const { error } = await supabase.rpc('credit_currency', {
      p_user_id: purchase.user_id,
      p_amount: purchase.currency_amount,
      p_reason: 'currency_top_up',
    })
    if (error) throw error
  }

  return { handled: true, status: mpStatus }
}

export interface WebhookClubParam {
  /** `club_id` of the notification URL, already validated as a uuid by the controller. */
  clubId: string | undefined
  /** `club_id` was present but not a uuid. */
  malformed: boolean
}

export async function handleWebhook(
  body: Record<string, unknown>,
  dataIdFromQuery: string | undefined,
  clubParam: WebhookClubParam = { clubId: undefined, malformed: false },
) {
  // Only handle payment notifications
  if (body.type !== 'payment') return { handled: false }

  const data = body.data as Record<string, unknown> | undefined
  const paymentId = data?.id ? String(data.id) : dataIdFromQuery ? String(dataIdFromQuery) : ''
  if (!paymentId) return { handled: false }

  // Notification-level id, used for idempotency (distinct from the MP payment id above)
  const eventId = body.id !== undefined ? String(body.id) : paymentId

  // Card #75: the seller whose token fetches the payment. No `club_id` means a
  // platform-collected payment (platform token, as before this card).
  const seller = await charging.resolveWebhookSeller(clubParam)
  if (seller.kind === 'reject') {
    // Nothing is changed and nothing is revealed: the caller got a 200 already.
    logger.warn({ paymentId, reason: seller.reason }, 'Ignored MercadoPago webhook: seller could not be resolved')
    return { handled: false, reason: seller.reason }
  }

  // Get payment details from MP
  const { details: mpPayment, httpStatus } = await createMpChargeClient(seller.accessToken).getPayment(paymentId)

  if (!mpPayment) {
    logger.error(
      { paymentId, status: httpStatus },
      'Failed to fetch payment details from MercadoPago',
    )
    return { handled: false }
  }

  const externalReference = mpPayment.external_reference
  const mpStatus = mpPayment.status
  const mpAmount = mpPayment.transaction_amount

  if (!externalReference) return { handled: false }

  // Card #63: currency top-ups live in their own table, tagged with a
  // 'currency:' prefix on external_reference so they never collide with a
  // real payments.id (both are plain UUIDs otherwise).
  if (externalReference.startsWith('currency:')) {
    if (seller.kind === 'club') {
      // Currency purchases are always the platform's: a club-tagged notification is not one.
      logger.warn({ paymentId }, 'Ignored MercadoPago webhook: currency purchase notified for a club')
      return { handled: false, reason: 'club_mismatch' }
    }
    return handleCurrencyWebhook(externalReference.slice('currency:'.length), eventId, paymentId, mpStatus, mpAmount)
  }

  const ourPaymentId = externalReference

  // Resolve the exact payment row by its own id (set as external_reference at
  // preference creation) — works the same whether a reservation has one payer
  // or four, unlike looking it up by reservation_id alone.
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id, mp_event_id, reservation_id, tournament_id, tournament_team_id, user_id, amount, club_id, collected_via, marketplace_fee, seller_mp_user_id')
    .eq('id', ourPaymentId)
    .maybeSingle()

  if (!existingPayment) {
    logger.error({ ourPaymentId, paymentId }, 'Webhook received for unknown payment')
    return { handled: false }
  }

  // Card #75: never trust the query alone. The `club_id` that selected the
  // token must be the club the row was charged for, collected by that club.
  const validation = charging.validateWebhookPayment(seller, existingPayment)
  if (!validation.ok) {
    logger.warn({ ourPaymentId, paymentId, reason: validation.reason }, 'Ignored MercadoPago webhook: club does not match the payment')
    return { handled: false, reason: validation.reason }
  }
  if (
    seller.kind === 'club' &&
    mpPayment.collector_id &&
    existingPayment.seller_mp_user_id &&
    mpPayment.collector_id !== existingPayment.seller_mp_user_id
  ) {
    logger.warn({ ourPaymentId, paymentId }, 'Ignored MercadoPago webhook: collector is not the club account of the payment')
    return { handled: false, reason: 'seller_mismatch' }
  }

  if (existingPayment.mp_event_id === eventId) {
    return { handled: true, status: mpStatus, deduped: true }
  }

  // Amount check: the paid amount must match this payment row's expected share.
  const expectedAmount = Number(existingPayment.amount)
  if (Number.isFinite(expectedAmount) && Math.abs(mpAmount - expectedAmount) > 0.01) {
    logger.error(
      { ourPaymentId, paymentId, mpAmount, expectedAmount },
      'MercadoPago webhook amount mismatch — refusing to confirm payment',
    )
    await supabase
      .from('payments')
      .update({
        mp_payment_id: paymentId,
        mp_event_id: eventId,
        metadata: { amount_mismatch: true, mpAmount, expectedAmount },
      })
      .eq('id', ourPaymentId)
    return { handled: false, reason: 'amount_mismatch' }
  }

  const paymentStatus =
    mpStatus === 'approved' ? 'approved' :
    mpStatus === 'rejected' ? 'rejected' :
    mpStatus === 'cancelled' ? 'cancelled' :
    'pending'

  const update: Record<string, unknown> = { status: paymentStatus, mp_payment_id: paymentId, mp_event_id: eventId }
  if (mpPayment.collector_id) update.seller_mp_user_id = mpPayment.collector_id
  if (seller.kind === 'club') {
    // The fee Mercado Pago reports applying wins over the one we sent.
    const storedFee = Number(existingPayment.marketplace_fee ?? 0)
    const fee = mpPayment.application_fee ?? storedFee
    if (mpPayment.application_fee !== null && Math.abs(mpPayment.application_fee - storedFee) > 0.01) {
      logger.warn(
        { ourPaymentId, paymentId, reportedFee: mpPayment.application_fee, storedFee },
        'MercadoPago reported a marketplace fee different from the one sent',
      )
    }
    update.marketplace_fee = fee
    update.net_amount = computeNetAmount(expectedAmount, fee)
  }

  // Card #77: a tournament registration is the same payment row with a
  // `tournament_id` (the team may be gone already: expired, withdrawn).
  const isTournamentPayment = Boolean(existingPayment.tournament_id || existingPayment.tournament_team_id)

  // Checkout Pro lets the buyer retry after a rejection with the same
  // preference, so a registration payment may still move from rejected, and one
  // that was cancelled on expiry may still be paid: both are allowed to become
  // `approved` (and are then refunded if the place no longer exists).
  await supabase
    .from('payments')
    .update(update)
    .eq('id', ourPaymentId)
    .in('status', isTournamentPayment ? ['pending', 'rejected', 'cancelled'] : ['pending'])

  if (isTournamentPayment) {
    // Rejected/cancelled: nothing to undo, the unpaid registration releases its
    // place by itself when its time runs out.
    if (mpStatus === 'approved') {
      await confirmTournamentPayment(ourPaymentId, existingPayment.tournament_team_id, existingPayment.tournament_id)
    }
  } else if (mpStatus === 'approved') {
    await confirmMatchPayment(existingPayment.reservation_id, existingPayment.user_id)
  } else if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
    // Only cancel the reservation outright for the plain single-payer flow — a
    // failed share on a match just leaves that seat open for someone else.
    const { data: match } = await supabase
      .from('matches')
      .select('id')
      .eq('reservation_id', existingPayment.reservation_id)
      .maybeSingle()

    if (!match) {
      await reservationRepository.updateStatus(existingPayment.reservation_id, 'cancelled')
    }
  }

  return { handled: true, status: mpStatus }
}

// Card #57: refunds a single approved payment via MercadoPago's refund API.
// Used for a player leaving, a match cancelled by its creator, the club's own
// cancellation and the auto-cancel job when a match never fills.
//
// Card #75: the refund is made with the token of the account that collected the
// payment (`collected_via` / club), and accepts an optional `amount` for a
// PARTIAL refund (MP's refunds endpoint with `{ amount }`; card #76 uses it for
// the late window of a club's policy; NOT verified against the sandbox). A full
// refund (no amount) sets the payment `refunded`; a partial one leaves it
// `approved` and records the refund in `metadata.partial_refunds`.
//
// Card #76: `attemptRefund` returns WHY a refund did not happen, so a policy
// refund can be left `pending` with a reason. It never throws.
async function attemptRefund(paymentId: string, amount?: number): Promise<AttemptRefundResult> {
  const { data: payment } = await supabase
    .from('payments')
    .select('id, mp_payment_id, status, amount, club_id, collected_via, metadata')
    .eq('id', paymentId)
    .single()

  if (!payment || payment.status !== 'approved' || !payment.mp_payment_id) {
    return { ok: false, error: 'PAYMENT_NOT_REFUNDABLE' }
  }

  let partialAmount: number | undefined
  if (amount !== undefined) {
    const paid = Number(payment.amount)
    const cents = Math.round(amount * 100)
    if (!Number.isFinite(amount) || cents <= 0 || cents > Math.round(paid * 100)) {
      return { ok: false, error: 'INVALID_AMOUNT' }
    }
    // An amount equal to the payment is a full refund.
    partialAmount = cents === Math.round(paid * 100) ? undefined : cents / 100
  }

  let accessToken: string
  try {
    accessToken = await charging.resolveRefundToken(payment)
  } catch (err) {
    const code = err instanceof AppError ? err.code : undefined
    logger.error(
      { paymentId, code },
      'Could not obtain the Mercado Pago token of the account that collected the payment',
    )
    return { ok: false, error: `CLUB_ACCOUNT_UNAVAILABLE${code ? `:${code}` : ''}` }
  }

  let res: { ok: boolean; httpStatus: number }
  try {
    res = await createMpChargeClient(accessToken).refund(payment.mp_payment_id, partialAmount)
  } catch (err) {
    logger.error({ paymentId, mpPaymentId: payment.mp_payment_id }, 'MercadoPago refund request failed')
    return { ok: false, error: 'MP_REFUND_REQUEST_FAILED' }
  }

  if (!res.ok) {
    logger.error(
      { paymentId, mpPaymentId: payment.mp_payment_id, status: res.httpStatus },
      'MercadoPago refund failed',
    )
    return { ok: false, error: `MP_REFUND_REJECTED:${res.httpStatus}` }
  }

  if (partialAmount === undefined) {
    await supabase
      .from('payments')
      .update({ status: 'refunded', refund_status: 'full', refunded_amount: Number(payment.amount), refund_error: null })
      .eq('id', paymentId)
  } else {
    const previous = (payment.metadata as Record<string, unknown> | null) ?? {}
    const list = Array.isArray(previous.partial_refunds) ? (previous.partial_refunds as unknown[]) : []
    await supabase
      .from('payments')
      .update({
        metadata: { ...previous, partial_refunds: [...list, { amount: partialAmount, at: new Date().toISOString() }] },
      })
      .eq('id', paymentId)
  }
  return { ok: true }
}

export async function refundPayment(paymentId: string, amount?: number): Promise<boolean> {
  const result = await attemptRefund(paymentId, amount)
  if (!result.ok && result.error === 'INVALID_AMOUNT') {
    throw new AppError('Refund amount must be greater than 0 and not exceed the payment', 400, 'VALIDATION_ERROR')
  }
  return result.ok
}

// Card #76: refund policy per club. Wires the pure core (refund-policy.core.ts)
// to the real policy lookup, Mercado Pago refund and notifications.
const refundPolicy = createRefundPolicyCore({
  resolvePolicy: resolveEffectivePolicy,
  attemptRefund,
  recordRefund: (paymentId, record) => paymentRepository.updatePaymentRefundState(paymentId, record),
  notifyRefundPending: async ({ clubId, outcomes }) => {
    const count = outcomes.length
    const amount = outcomes.reduce((sum, o) => sum + Math.round(o.amount * 100), 0) / 100
    const ownerIds = await paymentRepository.findClubOwnerUserIds(clubId)
    // In-app and email are independent: one failing never blocks the other.
    await Promise.all([
      notifications
        .refundPending(ownerIds, { clubId, count, amount, paymentIds: outcomes.map((o) => o.payment_id) })
        .catch((err) => logger.error(err, 'Failed to create the refund_pending notification')),
      notifyRefundPending({ clubId, count, amount }),
    ])
  },
  now: () => new Date(),
  onError: (message, context) => logger.error(context, message),
})

// ---- Card #77: tournament registrations ----------------------------------------------------

// Tells the club's owners that refunds of a tournament are still owed.
async function notifyClubRefundsPending(clubId: string | null, paymentIds: string[], amount: number): Promise<void> {
  if (!clubId || paymentIds.length === 0) return
  const ownerIds = await paymentRepository.findClubOwnerUserIds(clubId)
  await Promise.all([
    notifications
      .refundPending(ownerIds, { clubId, count: paymentIds.length, amount, paymentIds })
      .catch((err) => logger.error(err, 'Failed to create the refund_pending notification')),
    notifyRefundPending({ clubId, count: paymentIds.length, amount }),
  ])
}

/**
 * Full refund of one approved registration payment (a place that no longer
 * exists: expired registration, tournament full or no longer open, duplicate
 * payment). Never throws; a refund that cannot be completed is left `pending`
 * with its reason and the club's owners are told.
 */
export async function refundRegistrationInFull(paymentId: string, reason: string): Promise<boolean> {
  const result = await attemptRefund(paymentId).catch((err): AttemptRefundResult => {
    logger.error(err, `Failed to refund registration payment ${paymentId}`)
    return { ok: false, error: 'REFUND_ERROR' }
  })
  if (result.ok) {
    logger.info({ paymentId, reason }, 'Registration payment refunded in full')
    return true
  }
  const { data: row } = await supabase.from('payments').select('club_id, amount').eq('id', paymentId).maybeSingle()
  await paymentRepository
    .updatePaymentRefundState(paymentId, { refund_status: 'pending', refunded_amount: 0, refund_error: `${reason}:${result.error}` })
    .catch((err) => logger.error(err, `Failed to record the pending refund of payment ${paymentId}`))
  await notifyClubRefundsPending((row?.club_id as string | null) ?? null, [paymentId], Number(row?.amount ?? 0)).catch((err) =>
    logger.error(err, 'Failed to notify the pending registration refund'),
  )
  return false
}

const tournamentConfirmation = createConfirmationCore({
  now: () => new Date(),
  findTeam: (id) => tournamentRepository.findTeamById(id),
  findTournament: (id) => tournamentRepository.findRecord(id),
  countConfirmed: (id) => tournamentRepository.countConfirmed(id),
  updateTeam: (id, patch) => tournamentRepository.updateTeam(id, patch),
  deleteTeam: (id) => tournamentRepository.deleteTeam(id),
  refundInFull: refundRegistrationInFull,
  findUsers: (ids) => tournamentRepository.findUsers(ids),
  notifier: {
    registrationConfirmed: async (userIds, input) => {
      await notifications.tournamentRegistrationConfirmed(userIds, input)
    },
  },
  onError: (message, context) => logger.error(context, message),
})

/** An approved registration payment arrived (webhook): confirm the team or give the money back. */
export async function confirmTournamentPayment(
  paymentId: string,
  teamId: string | null,
  tournamentId: string | null,
) {
  const outcome = await tournamentConfirmation.confirmPaidRegistration({ paymentId, teamId, tournamentId })
  logger.info({ paymentId, teamId, tournamentId, outcome: outcome.outcome }, 'Tournament registration payment processed')
  return outcome
}

/** The player withdrew: the payments of the team are refunded per the club's policy (cutoff against the tournament start). */
export async function refundTournamentTeamByPolicy(input: {
  clubId: string
  payments: PolicyRefundPayment[]
  startsAt: string
}): Promise<PolicyRefundSummary> {
  return refundPaymentsByPolicy({ clubId: input.clubId, payments: input.payments, startsAt: input.startsAt })
}

/**
 * The club cancelled the tournament: every approved, unsettled payment goes back
 * at 100% (never the player policy). A refund that cannot be completed stays
 * `approved` with `refund_status = 'pending'` and the owners are told once.
 */
export async function refundAllTournamentPayments(tournamentId: string, clubId: string): Promise<RefundSummary> {
  const approved = await paymentRepository.findRefundableTournamentPayments({ tournamentId })
  const summary: RefundSummary = { payments: approved.length, refunded: 0, failed: [], amount_refunded: 0 }
  let cents = 0
  let pendingCents = 0
  for (const payment of approved) {
    const result = await attemptRefund(payment.id).catch((err): AttemptRefundResult => {
      logger.error(err, `Failed to refund payment ${payment.id} on tournament cancellation`)
      return { ok: false, error: 'REFUND_ERROR' }
    })
    if (result.ok) {
      summary.refunded += 1
      cents += Math.round(Number(payment.amount) * 100)
    } else {
      summary.failed.push(payment.id)
      pendingCents += Math.round(Number(payment.amount) * 100)
      await paymentRepository
        .updatePaymentRefundState(payment.id, { refund_status: 'pending', refunded_amount: 0, refund_error: result.error })
        .catch((err) => logger.error(err, `Failed to record the pending refund of payment ${payment.id}`))
    }
  }
  summary.amount_refunded = cents / 100
  await notifyClubRefundsPending(clubId, summary.failed, pendingCents / 100).catch((err) =>
    logger.error(err, 'Failed to notify the pending tournament refunds'),
  )
  return summary
}

export type { PolicyRefundSummary, PolicyRefundPayment }

/**
 * Refunds payments of a cancellation initiated by a PLAYER (leaving, creator
 * cancelling the match, booker cancelling the reservation) according to the
 * club's policy: 100% before the cutoff, the late percentage inside the window,
 * nothing after the start. A refund that cannot be completed leaves the payment
 * `pending` (never throws) and the club's owners are notified.
 */
export function refundPaymentsByPolicy(input: {
  clubId: string | null
  payments: PolicyRefundPayment[]
  startsAt: Date | string
  cancelledAt?: Date
}): Promise<PolicyRefundSummary> {
  return refundPolicy.refundByPolicy(input)
}

// Card #76: a payment the policy already settled (`none`, `partial`, `full`) has
// nothing left to refund; `pending`/`failed` ones are still owed and are retried
// by a club cancellation. Rows from before the card have a null refund_status.
const STILL_REFUNDABLE = 'refund_status.is.null,refund_status.in.(pending,failed)'

export async function findApprovedPayment(reservationId: string, userId: string) {
  const { data, error } = await supabase
    .from('payments')
    .select('id, user_id, status, amount')
    .eq('reservation_id', reservationId)
    .eq('user_id', userId)
    .eq('status', 'approved')
    .or(STILL_REFUNDABLE)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function findApprovedPaymentsForReservation(reservationId: string) {
  const { data, error } = await supabase
    .from('payments')
    .select('id, user_id, status, amount')
    .eq('reservation_id', reservationId)
    .eq('status', 'approved')
    .or(STILL_REFUNDABLE)

  if (error) throw error
  return data ?? []
}

export interface RefundSummary {
  /** Approved payments the reservation had. */
  payments: number
  refunded: number
  /** Payment ids whose refund MercadoPago did not accept: still `approved`, to be handled by hand. */
  failed: string[]
  /** Sum of the refunded payments, ARS. */
  amount_refunded: number
}

// Card #71: club-initiated cancellations return everything that was paid, to
// every payer (a match has up to four), regardless of how close the start is.
// Card #76: this stays 100%: the club's policy only applies to the player's own cancellations.
export async function refundAllApprovedPayments(reservationId: string): Promise<RefundSummary> {
  const approved = await findApprovedPaymentsForReservation(reservationId)
  const summary: RefundSummary = { payments: approved.length, refunded: 0, failed: [], amount_refunded: 0 }
  let cents = 0
  for (const payment of approved) {
    const result = await attemptRefund(payment.id).catch((err): AttemptRefundResult => {
      logger.error(err, `Failed to refund payment ${payment.id} on club cancellation`)
      return { ok: false, error: 'REFUND_ERROR' }
    })
    if (result.ok) {
      summary.refunded += 1
      cents += Math.round(Number(payment.amount) * 100)
    } else {
      summary.failed.push(payment.id)
      // Card #76: keep the reason so the club can see the refund is still owed.
      await paymentRepository
        .updatePaymentRefundState(payment.id, { refund_status: 'pending', refunded_amount: 0, refund_error: result.error })
        .catch((err) => logger.error(err, `Failed to record the pending refund of payment ${payment.id}`))
    }
  }
  summary.amount_refunded = cents / 100
  return summary
}
