import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { loadAccess, requireClubRole } from '../../middleware/access.middleware'
import { uploadClubDocument } from '../../middleware/upload'
import * as controller from './club-admin.controller'
import teamRouter from '../team/team.router'
import mercadoPagoRouter from '../club-mercadopago/club-mercadopago.router'
import tournamentAdminRouter from '../tournaments/tournament-admin.router'

// Mounted at /api/v1/club-admin/:clubId, hence mergeParams to see `clubId`.
const router = Router({ mergeParams: true })

router.use(requireAuth, loadAccess)

const anyStaff = requireClubRole(['owner', 'admin', 'staff'])
const ownerOrAdmin = requireClubRole(['owner', 'admin'])
const ownerOnly = requireClubRole(['owner'])

router.get('/summary', anyStaff, controller.getSummary)
router.get('/reservations', anyStaff, controller.listReservations)
router.patch('/reservations/:id', anyStaff, controller.updateReservation)
// Card #71: calendar, move/cancel (reception manages existing reservations, never creates) and blocks.
router.get('/calendar', anyStaff, controller.getCalendar)
router.patch('/reservations/:id/move', anyStaff, controller.moveReservation)
router.post('/reservations/:id/cancel', anyStaff, controller.cancelReservation)
router.get('/blocks', anyStaff, controller.listBlocks)
router.post('/blocks', ownerOrAdmin, controller.createBlocks)
router.delete('/blocks/:id', ownerOrAdmin, controller.deleteBlock)
router.get('/matches', ownerOrAdmin, controller.listMatches)
// Card #77: tournaments are managed by the club (create, publish, fixture, results, standings).
router.use('/tournaments', tournamentAdminRouter)
// Card #67: onboarding. Registered before '/' only for readability; paths are distinct.
router.get('/onboarding', ownerOrAdmin, controller.getOnboarding)
router.post('/submit', ownerOnly, controller.submitApplication)
router.get('/courts', ownerOrAdmin, controller.listCourts)
router.post('/courts', ownerOrAdmin, controller.createCourt)
router.patch('/courts/:id', ownerOrAdmin, controller.updateCourt)
router.delete('/courts/:id', ownerOrAdmin, controller.deleteCourt)
// Card #70: schedules, exceptions, price rules and preview. Staff read, owner/admin write.
router.get('/courts/:courtId/schedule', anyStaff, controller.getCourtSchedule)
router.put('/courts/:courtId/schedule', ownerOrAdmin, controller.replaceCourtSchedule)
router.get('/courts/:courtId/price-rules', anyStaff, controller.getPriceRules)
router.put('/courts/:courtId/price-rules', ownerOrAdmin, controller.replacePriceRules)
router.get('/courts/:courtId/preview', anyStaff, controller.previewCourtDay)
router.get('/schedule-exceptions', anyStaff, controller.listExceptions)
router.post('/schedule-exceptions', ownerOrAdmin, controller.createExceptions)
router.delete('/schedule-exceptions/:id', ownerOrAdmin, controller.deleteException)
router.post('/documents', ownerOrAdmin, uploadClubDocument, controller.uploadDocument)
router.delete('/documents/:id', ownerOrAdmin, controller.deleteDocument)
router.get('/documents/:id/url', ownerOrAdmin, controller.getDocumentUrl)
// Card #72: club team (owner/admin read, owner writes). Own role checks inside.
router.use('/team', teamRouter)
// Card #74: Mercado Pago account of the club. Owner only (each route has its own check).
router.use('/mercadopago', mercadoPagoRouter)
// Card #75: the club's own payments with fee and net, owner only (no commission editing here).
router.get('/payments', ownerOnly, controller.listPayments)
// Card #76: the club's refund policy (within the platform limits). Staff read, owner/admin write.
router.get('/refund-policy', anyStaff, controller.getRefundPolicy)
router.put('/refund-policy', ownerOrAdmin, controller.putRefundPolicy)
router.get('/', anyStaff, controller.getClub)
router.patch('/', ownerOrAdmin, controller.updateClub)

export default router
