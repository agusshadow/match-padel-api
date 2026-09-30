import crypto from 'crypto'
import { supabase } from '../../lib/supabase'
import { preference } from '../../lib/mercadopago'
import { logger } from '../../lib/logger'
import { matchRepository } from '../matches/match.repository'
import * as reservationRepository from '../reservations/reservation.repository'
import { notifications } from '../notifications/notification.service'
import { NotFoundError, ForbiddenError, AppError, ConflictError } from '../../types/errors'

const APP_URL = process.env.APP_URL ?? 'https://match-padel-web.vercel.app'
const API_URL = process.env.API_URL ?? 'https://match-padel-api.railway.app'
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET ?? ''

export interface PreferenceResult {
  preference_id: string
  init_point: string
  sandbox_init_point: string
}

// Shared by both the single-payer reservation flow and the per-player match
// split payments: inserts the `payments` row first so its id can be used as
// the MercadoPago `external_reference` — the webhook then resolves the exact
// row unambiguously, whether a reservation has one payer or four.
async function createPreferenceForPayment(
  reservationId: string,
  userId: string,
  amount: number,
  title: string,
): Promise<PreferenceResult> {
  const { data: paymentRow, error: insertErr } = await supabase
    .from('payments')
    .insert({
      reservation_id: reservationId,
      user_id: userId,
      amount,
      currency: 'ARS',
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertErr) throw insertErr

  let pref
  try {
    pref = await preference.create({
      body: {
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
          success: `${APP_URL}/reservations/${reservationId}?payment=success`,
          failure: `${APP_URL}/reservations/${reservationId}?payment=failure`,
          pending: `${APP_URL}/reservations/${reservationId}?payment=pending`,
        },
        auto_return: 'approved',
        notification_url: `${API_URL}/api/v1/payments/webhook`,
      },
    })
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

  return result
}

export async function createPaymentPreference(
  reservationId: string,
  userId: string,
) {
  const { data: reservation, error } = await supabase
    .from('court_reservations')
    .select(`
      id, user_id, total_price, status,
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

  return createPreferenceForPayment(
    reservationId,
    userId,
    Number(reservation.total_price),
    `Reserva – ${courtName} en ${clubName}`,
  )
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

  return createPreferenceForPayment(
    match.reservation_id,
    userId,
    share,
    `Partido – ${reservation.court.name} en ${reservation.court.club.name} (1/4)`,
  )
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

export async function handleWebhook(
  body: Record<string, unknown>,
  dataIdFromQuery: string | undefined,
) {
  // Only handle payment notifications
  if (body.type !== 'payment') return { handled: false }

  const data = body.data as Record<string, unknown> | undefined
  const paymentId = data?.id ? String(data.id) : dataIdFromQuery ? String(dataIdFromQuery) : ''
  if (!paymentId) return { handled: false }

  // Notification-level id, used for idempotency (distinct from the MP payment id above)
  const eventId = body.id !== undefined ? String(body.id) : paymentId

  // Get payment details from MP
  const mpResponse = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN ?? ''}`,
      },
    },
  )

  if (!mpResponse.ok) {
    logger.error(
      { paymentId, status: mpResponse.status },
      'Failed to fetch payment details from MercadoPago',
    )
    return { handled: false }
  }

  const mpPayment = (await mpResponse.json()) as Record<string, unknown>
  const ourPaymentId = mpPayment.external_reference as string
  const mpStatus = mpPayment.status as string
  const mpAmount = Number(mpPayment.transaction_amount)

  if (!ourPaymentId) return { handled: false }

  // Resolve the exact payment row by its own id (set as external_reference at
  // preference creation) — works the same whether a reservation has one payer
  // or four, unlike looking it up by reservation_id alone.
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id, mp_event_id, reservation_id, user_id, amount')
    .eq('id', ourPaymentId)
    .maybeSingle()

  if (!existingPayment) {
    logger.error({ ourPaymentId, paymentId }, 'Webhook received for unknown payment')
    return { handled: false }
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

  await supabase
    .from('payments')
    .update({ status: paymentStatus, mp_payment_id: paymentId, mp_event_id: eventId })
    .eq('id', ourPaymentId)
    .eq('status', 'pending')

  if (mpStatus === 'approved') {
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
// Used both for a player leaving >24h before the match and for the
// auto-cancel job when a match never fills.
export async function refundPayment(paymentId: string): Promise<boolean> {
  const { data: payment } = await supabase
    .from('payments')
    .select('id, mp_payment_id, status')
    .eq('id', paymentId)
    .single()

  if (!payment || payment.status !== 'approved' || !payment.mp_payment_id) {
    return false
  }

  const res = await fetch(
    `https://api.mercadopago.com/v1/payments/${payment.mp_payment_id}/refunds`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN ?? ''}`,
        'Content-Type': 'application/json',
      },
    },
  )

  if (!res.ok) {
    logger.error(
      { paymentId, mpPaymentId: payment.mp_payment_id, status: res.status },
      'MercadoPago refund failed',
    )
    return false
  }

  await supabase.from('payments').update({ status: 'refunded' }).eq('id', paymentId)
  return true
}

export async function findApprovedPayment(reservationId: string, userId: string) {
  const { data, error } = await supabase
    .from('payments')
    .select('id, status')
    .eq('reservation_id', reservationId)
    .eq('user_id', userId)
    .eq('status', 'approved')
    .maybeSingle()

  if (error) throw error
  return data
}

export async function findApprovedPaymentsForReservation(reservationId: string) {
  const { data, error } = await supabase
    .from('payments')
    .select('id, user_id, status')
    .eq('reservation_id', reservationId)
    .eq('status', 'approved')

  if (error) throw error
  return data ?? []
}
