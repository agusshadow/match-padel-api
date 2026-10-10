import { Router } from 'express'
import { requireClubRole } from '../../middleware/access.middleware'
import * as controller from './tournament-admin.controller'

// Mounted by club-admin.router.ts at /club-admin/:clubId/tournaments (the parent
// already ran requireAuth + loadAccess). Owner and administrator of the club, and
// platform superadmins; reception (staff) has no access (card #77).
const router = Router({ mergeParams: true })
const ownerOrAdmin = requireClubRole(['owner', 'admin'])

router.get('/', ownerOrAdmin, controller.list)
router.post('/', ownerOrAdmin, controller.create)
router.get('/:id', ownerOrAdmin, controller.detail)
router.patch('/:id', ownerOrAdmin, controller.update)
router.post('/:id/publish', ownerOrAdmin, controller.publish)
router.post('/:id/cancel', ownerOrAdmin, controller.cancel)
router.post('/:id/start', ownerOrAdmin, controller.start)
router.get('/:id/standings', ownerOrAdmin, controller.standings)
router.patch('/:id/matches/:matchId/result', ownerOrAdmin, controller.recordResult)

export default router
