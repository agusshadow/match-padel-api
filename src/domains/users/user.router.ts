import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { getMe, updateMe, getMyStats, getUserByUsername } from './user.controller'

const router = Router()

// Protected routes
router.get('/me', requireAuth, getMe)
router.put('/me', requireAuth, updateMe)
router.get('/me/stats', requireAuth, getMyStats)

// Public profile
router.get('/:username', getUserByUsername)

export default router
