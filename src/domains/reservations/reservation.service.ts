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
  findAvailableSlots,
} from './reservation.repository'
import type { CreateReservationRequest } from './reservation.validator'

const MAX_ACTIVE_RESERVATIONS = 3

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
    .select('id, club_id, price_per_hour, is_active')
    .eq('id', data.court_id)
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

  // 6. Check slot availability — ensure no overlap
  const dateStr = data.start_time.slice(0, 10)
  const slots = await findAvailableSlots(data.court_id, dateStr)
  const requestedSlot = slots.find(
    (s) => s.start_time === data.start_time && s.end_time === data.end_time,
  )

  // If slot system doesn't perfectly match (e.g. custom times), do direct conflict check
  if (requestedSlot !== undefined && !requestedSlot.available) {
    throw new ConflictError('This time slot is no longer available')
  }

  if (requestedSlot === undefined) {
    // Custom time range — do a direct overlap query
    const { data: conflicts, error: confErr } = await supabase
      .from('court_reservations')
      .select('id')
      .eq('court_id', data.court_id)
      .in('status', ['pending', 'confirmed'])
      .lt('start_time', data.end_time)
      .gt('end_time', data.start_time)

    if (confErr) throw confErr

    if (conflicts && conflicts.length > 0) {
      throw new ConflictError('This time slot conflicts with an existing reservation')
    }
  }

  // 7. Calculate total price
  const totalPrice = Math.round(court.price_per_hour * durationHours * 100) / 100

  // 8. Create the reservation
  return create({
    ...data,
    userId,
    clubId: court.club_id,
    totalPrice,
  })
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

  return result
}
