import { Request, Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '../../middleware/auth'
import { NotFoundError, ForbiddenError, UnauthorizedError } from '../../types/errors'
import {
  findByUser,
  findById,
} from './reservation.repository'
import { validateAndCreateReservation, cancelReservation, getCourtSlots } from './reservation.service'
import {
  CreateReservationSchema,
  GetSlotsSchema,
  GetReservationsQuerySchema,
} from './reservation.validator'

function getUserId(req: Request): string {
  const userId = (req as AuthenticatedRequest).userId
  if (!userId) throw new UnauthorizedError()
  return userId
}

export async function getMyReservations(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = getUserId(req)
    const query = GetReservationsQuerySchema.parse(req.query)

    const { data, total } = await findByUser(userId, query)

    res.json({
      success: true,
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    })
  } catch (err) {
    next(err)
  }
}

export async function getReservationById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = getUserId(req)
    const { id } = req.params

    const reservation = await findById(id)
    if (!reservation) throw new NotFoundError('Reservation')

    if (reservation.user_id !== userId) {
      throw new ForbiddenError('You can only view your own reservations')
    }

    res.json({ success: true, data: reservation })
  } catch (err) {
    next(err)
  }
}

export async function getAvailableSlots(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { courtId } = req.params
    const { date } = GetSlotsSchema.parse({ court_id: courtId, date: req.query.date })

    const { slots, payments_enabled, refund_policy } = await getCourtSlots(courtId, date)

    // Card #75: `data` stays the slots array; the flag travels in `meta`.
    // Card #76: so does the club's refund policy.
    res.json({ success: true, data: slots, meta: { payments_enabled, refund_policy } })
  } catch (err) {
    next(err)
  }
}

export async function createReservation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = getUserId(req)
    const body = CreateReservationSchema.parse(req.body)

    const reservation = await validateAndCreateReservation(userId, body)

    res.status(201).json({ success: true, data: reservation })
  } catch (err) {
    next(err)
  }
}

export async function cancelReservationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = getUserId(req)
    const { id } = req.params

    const reservation = await cancelReservation(id, userId)

    res.json({ success: true, data: reservation })
  } catch (err) {
    next(err)
  }
}
