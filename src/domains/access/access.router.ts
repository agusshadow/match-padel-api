import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { loadAccess } from '../../middleware/access.middleware'
import { acceptInvitationLimiter, createClubLimiter } from '../../middleware/rate-limit'
import { createMyClub } from '../club-admin/club-admin.controller'
import { acceptInvitation } from '../team/team.controller'
import { getAccess } from './access.controller'

const router = Router()

// GET /api/v1/me/access
router.get('/access', requireAuth, loadAccess, getAccess)

// POST /api/v1/me/clubs (card #67): any signed-in user starts a club application.
router.post('/clubs', createClubLimiter, requireAuth, createMyClub)

// POST /api/v1/me/invitations/accept (card #72): the signed-in user joins a club with the invited role.
router.post('/invitations/accept', acceptInvitationLimiter, requireAuth, acceptInvitation)

export default router
