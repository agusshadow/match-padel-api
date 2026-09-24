import { Router } from 'express'
import { getAvailableSlots } from '../reservations/reservation.controller'

const router = Router()

// GET /api/v1/courts/:courtId/slots?date=YYYY-MM-DD — public
router.get('/:courtId/slots', getAvailableSlots)

export default router
