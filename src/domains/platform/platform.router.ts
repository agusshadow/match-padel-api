import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { loadAccess, requireRole } from '../../middleware/access.middleware'
import * as controller from './platform.controller'
import catalogsRouter from '../catalogs/catalogs.router'

const router = Router()

router.use(requireAuth, loadAccess)

// A superadmin passes any list. Reviewers (card #67) only get what lists 'reviewer'.
const superadminOnly = requireRole(['superadmin'])
const reviewerOrAbove = requireRole(['reviewer'])

router.get('/summary', superadminOnly, controller.getSummary)
router.get('/clubs', reviewerOrAbove, controller.listClubs)
router.post('/clubs', superadminOnly, controller.createClub)
router.patch('/clubs/:id/active', superadminOnly, controller.setClubActive)
router.get('/clubs/:clubId/documents/:id/url', reviewerOrAbove, controller.getClubDocumentUrl)
router.get('/applications', reviewerOrAbove, controller.listApplications)
router.get('/applications/:clubId', reviewerOrAbove, controller.getApplication)
router.post('/applications/:clubId/approve', reviewerOrAbove, controller.approveApplication)
router.post('/applications/:clubId/request-changes', reviewerOrAbove, controller.requestChanges)
router.post('/applications/:clubId/reject', reviewerOrAbove, controller.rejectApplication)
router.post('/clubs/:clubId/reopen', superadminOnly, controller.reopenClub)
router.post('/clubs/:clubId/suspend', superadminOnly, controller.suspendClub)
router.post('/clubs/:clubId/unsuspend', superadminOnly, controller.unsuspendClub)
// Card #75: commission, collection mode and payments, superadmin only.
router.patch('/clubs/:clubId/commission', superadminOnly, controller.setClubCommission)
router.patch('/clubs/:clubId/collection-mode', superadminOnly, controller.setClubCollectionMode)
router.get('/payments', superadminOnly, controller.listPayments)
router.get('/users', superadminOnly, controller.listUsers)
router.get('/audit-log', superadminOnly, controller.getAuditLog)

// Card #78 (Admin F5): gamification catalogs, superadmin only (a reviewer is 403).
router.use('/catalogs', superadminOnly, catalogsRouter)

export { router as platformRouter }
export default router
