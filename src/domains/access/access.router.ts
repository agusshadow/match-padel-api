import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { loadAccess } from '../../middleware/access.middleware'
import { getAccess } from './access.controller'

const router = Router()

// GET /api/v1/me/access
router.get('/access', requireAuth, loadAccess, getAccess)

export default router
