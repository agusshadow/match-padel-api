import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { loadAccess } from '../../middleware/access.middleware'
import { createClubLimiter } from '../../middleware/rate-limit'
import { createMyClub } from '../club-admin/club-admin.controller'
import { getAccess } from './access.controller'

const router = Router()

// GET /api/v1/me/access
router.get('/access', requireAuth, loadAccess, getAccess)

// POST /api/v1/me/clubs (card #67): any signed-in user starts a club application.
router.post('/clubs', createClubLimiter, requireAuth, createMyClub)

export default router
