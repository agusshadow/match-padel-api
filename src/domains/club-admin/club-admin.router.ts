import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { loadAccess, requireClubRole } from '../../middleware/access.middleware'
import * as controller from './club-admin.controller'

// Mounted at /api/v1/club-admin/:clubId, hence mergeParams to see `clubId`.
const router = Router({ mergeParams: true })

router.use(requireAuth, loadAccess)

const anyStaff = requireClubRole(['owner', 'admin', 'staff'])
const ownerOrAdmin = requireClubRole(['owner', 'admin'])

router.get('/summary', anyStaff, controller.getSummary)
router.get('/reservations', anyStaff, controller.listReservations)
router.patch('/reservations/:id', anyStaff, controller.updateReservation)
router.get('/matches', ownerOrAdmin, controller.listMatches)
router.get('/tournaments', ownerOrAdmin, controller.listTournaments)
router.get('/', anyStaff, controller.getClub)
router.patch('/', ownerOrAdmin, controller.updateClub)

export default router
