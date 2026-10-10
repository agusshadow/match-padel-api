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
router.get('/users', superadminOnly, controller.listUsers)
router.get('/audit-log', superadminOnly, controller.getAuditLog)

export { router as platformRouter }
export default router
