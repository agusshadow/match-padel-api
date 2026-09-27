import { Router } from 'express'
import { getClubes, getClubById, getClubCourts, getClubAvailabilityHandler } from './club.controller'

const router = Router()

// Public routes — no auth required
// GET /api/v1/clubs
router.get('/', getClubes)

// GET /api/v1/clubs/:id
router.get('/:id', getClubById)

// GET /api/v1/clubs/:clubId/courts
router.get('/:clubId/courts', getClubCourts)

// GET /api/v1/clubs/:clubId/availability?date=YYYY-MM-DD
router.get('/:clubId/availability', getClubAvailabilityHandler)


export default router
