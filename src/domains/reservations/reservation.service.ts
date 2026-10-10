import { supabase } from '../../lib/supabase'
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../types/errors'
import {
  create,
  cancel,
  countActiveByUser,
  hasOverlap,
  hasBlockOverlap,
  cancelIfOpen,
  findById,
  findClubIdOfCourt,
  findAvailableSlots,
  expirePendingReservations,
} from './reservation.repository'
import type { CreateReservationRequest } from './reservation.validator'
import { notifications } from '../notifications/notification.service'
import { logger } from '../../lib/logger'
import { loadScheduleContextForCourt } from '../courts/court.repository'
import { formatLocalDateTime, localDateOf, quoteRangeOrThrow } from '../courts/schedule.service'
import { matchRepository } from '../matches/match.repository'
import { matchService } from '../matches/match.service'
import {
  assertClubCanCharge,
  getClubPaymentsStatus,
  refundAllApprovedPayments,
  refundPaymentsByPolicy,
  findApprovedPaymentsForReservation,
  type RefundSummary,
} from '../payments/payment.service'
import { toPlayerRefundResult, type PlayerRefundResult } from '../payments/refund-policy.core'
import { getPublicRefundPolicy, type PublicRefundPolicy } from '../payments/refund-policy.service'
import type { TimeSlot } from './reservation.repository'

const MAX_ACTIVE_RESERVATIONS = 3
export const PENDING_RESERVATION_EXPIRY_MINUTES = 15

export async function validateAndCreateReservation(
  userId: string,
  data: CreateReservationRequest,
) {
  const startTime = new Date(data.start_time)
  const endTime = new Date(data.end_time)
  const now = new Date()

  // 1. start_time must be in the future
  if (startTime <= now) {
    throw new ValidationError('start_time must be in the future')
  }

  // 2. end_time must be after start_time
  if (endTime <= startTime) {
    throw new ValidationError('end_time must be after start_time')
  }

  // 3. Duration must be at least 30 minutes and at most 4 hours
  const durationMs = endTime.getTime() - startTime.getTime()
  const durationHours = durationMs / (1000 * 60 * 60)
  if (durationMs < 30 * 60 * 1000) {
    throw new ValidationError('Minimum reservation duration is 30 minutes')
  }
  if (durationHours > 4) {
    throw new ValidationError('Maximum reservation duration is 4 hours')
  }

  // 4. Verify court exists and is active
  const { data: court, error: courtErr } = await supabase
    .from('courts')
    .select('id, club_id, price_per_hour, is_active, club:clubs!inner(status, is_active)')
    .eq('id', data.court_id)
    .eq('club.status', 'approved') // card #67: only courts of approved, active clubs are bookable
    .eq('club.is_active', true)
    .single()

  if (courtErr || !court) {
    throw new NotFoundError('Court')
  }

  if (!court.is_active) {
    throw new ValidationError('This court is not available for reservations')
  }

  // 5. Check user's active reservation limit
  const activeCount = await countActiveByUser(userId)
  if (activeCount >= MAX_ACTIVE_RESERVATIONS) {
    throw new AppError(
      `You can have at most ${MAX_ACTIVE_RESERVATIONS} upcoming reservations`,
      409,
      'RESERVATION_LIMIT_EXCEEDED',
    )
  }

  // 6. The range must be whole slots of the court's effective schedule
  // (weekly hours, exceptions, club fallback) — card #70. This also prices it.
  const scheduleContext = await loadScheduleContextForCourt({
    courtId: data.court_id,
    clubId: court.club_id,
    basePricePerHour: court.price_per_hour,
    fromDate: localDateOf(startTime),
    toDate: localDateOf(new Date(endTime.getTime() - 1)),
  })
  const quote = quoteRangeOrThrow(scheduleContext, data.start_time, data.end_time)

  // 6a. Card #75: a paid reservation of a club that collects on its own Mercado
  // Pago account needs that account connected. Free flows are never affected.
  await assertClubCanCharge(court.club_id, quote.total_price)

  // 6b. Card #71: the club may have blocked the court for that time.
  if (await hasBlockOverlap(data.court_id, data.start_time, data.end_time)) {
    throw new AppError('This court is blocked for the requested time', 409, 'COURT_BLOCKED')
  }

  // 7. No overlap with another pending or confirmed reservation
  if (await hasOverlap(data.court_id, data.start_time, data.end_time)) {
    throw new ConflictError('This time slot is no longer available')
  }

  // Total computed on the server from the price rules; never from the client.
  const totalPrice = quote.total_price

  // 8. Create the reservation
  const reservation = await create({
    ...data,
    userId,
    clubId: court.club_id,
    totalPrice,
  })

  return reservation
}

// Card #76: the booker cancelling their own reservation now follows the club's
// refund policy for whatever was paid (before this card it never refunded):
// 100% before the club's cutoff, its late percentage in money inside the
// window, nothing once it started. A refund that cannot be completed does not
// block the cancellation: it is left pending and the club is told. A reservation
// that hosts a match cancels the match with it (the booker is its creator), so
// no match stays open on a cancelled court.
export async function cancelReservation(
  id: string,
  userId: string,
): Promise<Record<string, unknown> & { refund: PlayerRefundResult | null }> {
  const result = await cancel(id, userId).catch((err: Error) => {
    if (err.message === 'NOT_OWNER') {
      throw new ForbiddenError('You can only cancel your own reservations')
    }
    if (err.message === 'CANNOT_CANCEL') {
      throw new AppError(
        'This reservation cannot be cancelled (already cancelled or completed)',
        409,
        'CANNOT_CANCEL',
      )
    }
    throw err
  })

  if (!result) {
    throw new NotFoundError('Reservation')
  }

  const payments = await findApprovedPaymentsForReservation(id)
  const summary = await refundPaymentsByPolicy({
    clubId: result.club_id ?? result.court?.club?.id ?? null,
    payments: payments.map((p) => ({ id: p.id, user_id: p.user_id, amount: Number(p.amount) })),
    startsAt: result.start_time,
  })

  const match = await matchRepository.findByReservationId(id)
  if (match && match.status !== 'cancelled' && match.status !== 'completed') {
    await matchRepository.cancel(match.id as string)
    try {
      const players = await matchRepository.getPlayers(match.id as string)
      const otherPlayerIds = (players as Array<{ user_id: string }>)
        .map((p) => p.user_id)
        .filter((playerId) => playerId !== userId)
      if (otherPlayerIds.length > 0) {
        await notifications.matchCancelled(otherPlayerIds, match.id as string)
      }
      const otherPending = summary.outcomes
        .filter((o) => o.status === 'pending' && o.user_id !== userId)
        .map((o) => o.user_id)
      if (otherPending.length > 0) {
        await notifications.playerRefundPending(otherPending, match.id as string)
      }
    } catch (err) {
      logger.error(err, 'Failed to send reservation cancellation match notifications')
    }
  }

  // Notify user of cancellation
  notifications.reservationCancelled(userId, id).catch((err) => logger.error(err, 'Failed to send reservationCancelled notification'))

  return { ...result, refund: toPlayerRefundResult(summary) }
}

// Called by the scheduled job (src/jobs/expire-reservations.job.ts). Returns
// the ids that were cancelled, for logging.
export async function expireUnpaidReservations(): Promise<string[]> {
  return expirePendingReservations(PENDING_RESERVATION_EXPIRY_MINUTES)
}

// ---- Card #71: club-initiated cancellation and move ---------------------------

export interface ClubCancellationResult {
  previous_status: 'pending' | 'confirmed'
  refund: RefundSummary
  /** The match that was played on the reservation, cancelled with it; null for a plain reservation. */
  match: { id: string; status: 'cancelled' } | null
}

/** The booker plus every confirmed player of the match played on the reservation. */
async function affectedUserIds(bookerId: string, matchId: string | null): Promise<string[]> {
  const ids = new Set<string>([bookerId])
  if (matchId) {
    const players = await matchRepository.getPlayers(matchId)
    for (const p of players as Array<{ user_id: string }>) ids.add(p.user_id)
  }
  return [...ids]
}

/**
 * The club cancels a pending or confirmed reservation. ONE implementation for
 * `POST /club-admin/:clubId/reservations/:id/cancel` and for the status PATCH.
 *
 * Rules (documented in docs/endpoints.md):
 * - Always a 100% refund of every approved payment, whatever the time left,
 *   and the player is never penalized. The club's refund policy (card #76)
 *   only applies to the player's own cancellations.
 * - A reservation of a match cancels the match too (`matchService.cancelByClub`),
 *   so no match stays open on a cancelled reservation.
 * - The status change is a compare-and-set first, so a concurrent second
 *   cancellation gets 409 and never refunds twice.
 * - Notifications to the booker and the match players never fail the call.
 *
 * The caller has already checked that the reservation belongs to the club.
 */
export async function cancelReservationByClub(
  reservationId: string,
  input: { reason: string | null },
): Promise<ClubCancellationResult> {
  const reservation = await findById(reservationId)
  if (!reservation) throw new NotFoundError('Reservation')

  const match = await matchRepository.findByReservationId(reservationId)
  if (match?.status === 'completed') {
    throw new AppError('The match on this reservation is already completed', 409, 'MATCH_COMPLETED')
  }

  const previous = await cancelIfOpen(reservationId)
  if (!previous) {
    throw new AppError(
      'This reservation cannot be cancelled (already cancelled or completed)',
      409,
      'CANNOT_CANCEL',
    )
  }

  let refund: RefundSummary
  let cancelledMatch: ClubCancellationResult['match'] = null
  if (match && match.status !== 'cancelled') {
    refund = await matchService.cancelByClub(match.id as string, reservationId)
    cancelledMatch = { id: match.id as string, status: 'cancelled' }
  } else {
    refund = await refundAllApprovedPayments(reservationId)
  }

  try {
    const userIds = await affectedUserIds(reservation.user_id, match?.id ? (match.id as string) : null)
    await notifications.reservationCancelledByClub(userIds, {
      reservationId,
      matchId: cancelledMatch?.id ?? null,
      when: formatLocalDateTime(new Date(reservation.start_time)),
      courtName: reservation.court.name,
      reason: input.reason,
      refunded: refund.refunded > 0,
    })
  } catch (err) {
    logger.error(err, 'Failed to send club cancellation notifications')
  }

  return { previous_status: previous, refund, match: cancelledMatch }
}

/** Tells the booker and the match players that the club moved the reservation. Never throws. */
export async function notifyReservationMoved(input: {
  reservationId: string
  bookerId: string
  courtName: string
  from: { court_id: string; start_time: string; end_time: string }
  to: { court_id: string; start_time: string; end_time: string }
}): Promise<void> {
  try {
    const match = await matchRepository.findByReservationId(input.reservationId)
    const matchId = match?.id ? (match.id as string) : null
    const userIds = await affectedUserIds(input.bookerId, matchId)
    await notifications.reservationMoved(userIds, {
      reservationId: input.reservationId,
      matchId,
      courtName: input.courtName,
      from: { ...input.from, when: formatLocalDateTime(new Date(input.from.start_time)) },
      to: { ...input.to, when: formatLocalDateTime(new Date(input.to.start_time)) },
    })
  } catch (err) {
    logger.error(err, 'Failed to send reservation moved notifications')
  }
}

// ---- Card #75: slots of a court with the club's `payments_enabled` -----------------

/** Slots of a court plus whether its club can charge online (false only for a `club_account` club with no usable link). */
export async function getCourtSlots(
  courtId: string,
  date: string,
): Promise<{ slots: TimeSlot[]; payments_enabled: boolean; refund_policy: PublicRefundPolicy | null }> {
  const slots = await findAvailableSlots(courtId, date)
  const clubId = await findClubIdOfCourt(courtId)
  const payments_enabled = clubId ? (await getClubPaymentsStatus(clubId)).payments_enabled : true
  // Card #76: the club's refund policy, shown before the player pays.
  const refund_policy = clubId ? await getPublicRefundPolicy(clubId) : null
  return { slots, payments_enabled, refund_policy }
}
