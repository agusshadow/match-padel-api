import { Router } from 'express'
import { requireClubRole } from '../../middleware/access.middleware'
import { teamInvitationLimiter, invitationPreviewLimiter } from '../../middleware/rate-limit'
import * as controller from './team.controller'

// Club team, mounted by the club-admin router at /api/v1/club-admin/:clubId/team
// (requireAuth + loadAccess already ran there). Owner/admin read; only the owner writes.
const router = Router({ mergeParams: true })

const ownerOrAdmin = requireClubRole(['owner', 'admin'])
const ownerOnly = requireClubRole(['owner'])

router.get('/', ownerOrAdmin, controller.listTeam)
router.post('/invitations', teamInvitationLimiter, ownerOnly, controller.createInvitation)
router.post('/invitations/:id/resend', teamInvitationLimiter, ownerOnly, controller.resendInvitation)
router.delete('/invitations/:id', ownerOnly, controller.revokeInvitation)
router.patch('/members/:userId', ownerOnly, controller.changeMemberRole)
router.delete('/members/:userId', ownerOnly, controller.removeMember)

export default router

// Public, mounted at /api/v1/invitations. Reveals only club name, role, a masked
// email and whether it expired, to whoever holds the (unguessable) token.
export const invitationsRouter = Router()

invitationsRouter.get('/preview', invitationPreviewLimiter, controller.previewInvitation)
