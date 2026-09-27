import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import {
  getMyReservations,
  getReservationById,
  createReservation,
  cancelReservationHandler,
} from './reservation.controller'

const router = Router()

// All reservation routes require authentication
router.use(requireAuth)

// GET /api/v1/reservations — list user's reservations
router.get('/', getMyReservations)

// GET /api/v1/reservations/:id — get single reservation
router.get('/:id', getReservationById)

// POST /api/v1/reservations — create reservation
router.post('/', createReservation)

// DELETE /api/v1/reservations/:id — cancel reservation
router.delete('/:id', cancelReservationHandler)

export default router
