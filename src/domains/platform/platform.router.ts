import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { loadAccess, requireRole } from '../../middleware/access.middleware'
import * as controller from './platform.controller'

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
router.get('/users', superadminOnly, controller.listUsers)
router.get('/audit-log', superadminOnly, controller.getAuditLog)

export { router as platformRouter }
export default router
