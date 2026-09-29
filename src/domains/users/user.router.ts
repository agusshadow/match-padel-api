import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { uploadAvatar as uploadAvatarMiddleware } from '../../middleware/upload'
import { getMe, updateMe, uploadAvatar, getMyStats, getUserByUsername } from './user.controller'

const router = Router()

// Protected routes
router.get('/me', requireAuth, getMe)
router.put('/me', requireAuth, updateMe)
router.post('/me/avatar', requireAuth, uploadAvatarMiddleware, uploadAvatar)
router.get('/me/stats', requireAuth, getMyStats)

// Public profile
router.get('/:username', getUserByUsername)

export default router
