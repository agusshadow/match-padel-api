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
  expirePendingReservations,
} from './reservation.repository'
import type { CreateReservationRequest } from './reservation.validator'
import { notifications } from '../notifications/notification.service'
import { logger } from '../../lib/logger'
import { loadScheduleContextForCourt } from '../courts/court.repository'
import { localDateOf, quoteRangeOrThrow } from '../courts/schedule.service'

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

export async function cancelReservation(id: string, userId: string) {
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

  // Notify user of cancellation
  notifications.reservationCancelled(userId, id).catch((err) => logger.error(err, 'Failed to send reservationCancelled notification'))

  return result
}

// Called by the scheduled job (src/jobs/expire-reservations.job.ts). Returns
// the ids that were cancelled, for logging.
export async function expireUnpaidReservations(): Promise<string[]> {
  return expirePendingReservations(PENDING_RESERVATION_EXPIRY_MINUTES)
}
