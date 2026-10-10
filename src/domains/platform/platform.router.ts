import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { loadAccess, requireRole } from '../../middleware/access.middleware'
import * as controller from './platform.controller'

const router = Router()

// Superadmin only for now; the reviewer's application inbox arrives with F1.
router.use(requireAuth, loadAccess, requireRole(['superadmin']))

router.get('/summary', controller.getSummary)
router.get('/clubs', controller.listClubs)
router.post('/clubs', controller.createClub)
router.patch('/clubs/:id/active', controller.setClubActive)
router.get('/users', controller.listUsers)
router.get('/audit-log', controller.getAuditLog)

export { router as platformRouter }
export default router
