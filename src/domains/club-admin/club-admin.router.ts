import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { loadAccess, requireClubRole } from '../../middleware/access.middleware'
import { uploadClubDocument } from '../../middleware/upload'
import * as controller from './club-admin.controller'

// Mounted at /api/v1/club-admin/:clubId, hence mergeParams to see `clubId`.
const router = Router({ mergeParams: true })

router.use(requireAuth, loadAccess)

const anyStaff = requireClubRole(['owner', 'admin', 'staff'])
const ownerOrAdmin = requireClubRole(['owner', 'admin'])
const ownerOnly = requireClubRole(['owner'])

router.get('/summary', anyStaff, controller.getSummary)
router.get('/reservations', anyStaff, controller.listReservations)
router.patch('/reservations/:id', anyStaff, controller.updateReservation)
router.get('/matches', ownerOrAdmin, controller.listMatches)
router.get('/tournaments', ownerOrAdmin, controller.listTournaments)
// Card #67: onboarding. Registered before '/' only for readability; paths are distinct.
router.get('/onboarding', ownerOrAdmin, controller.getOnboarding)
router.post('/submit', ownerOnly, controller.submitApplication)
router.get('/courts', ownerOrAdmin, controller.listCourts)
router.post('/courts', ownerOrAdmin, controller.createCourt)
router.patch('/courts/:id', ownerOrAdmin, controller.updateCourt)
router.delete('/courts/:id', ownerOrAdmin, controller.deleteCourt)
router.post('/documents', ownerOrAdmin, uploadClubDocument, controller.uploadDocument)
router.delete('/documents/:id', ownerOrAdmin, controller.deleteDocument)
router.get('/documents/:id/url', ownerOrAdmin, controller.getDocumentUrl)
router.get('/', anyStaff, controller.getClub)
router.patch('/', ownerOrAdmin, controller.updateClub)

export default router
