import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { getCatalog, getMyAchievements } from './achievements.controller'

const router = Router()

// GET /api/v1/achievements — public catalog of all achievements
router.get('/', getCatalog)

// GET /api/v1/achievements/me — achievements the current user has earned
router.get('/me', requireAuth, getMyAchievements)

export default router
