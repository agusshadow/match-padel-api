import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { getCatalog, getMyChallenges } from './challenges.controller'

const router = Router()

// GET /api/v1/challenges — public catalog of active challenges
router.get('/', getCatalog)

// GET /api/v1/challenges/me — current user's active + completed challenges
router.get('/me', requireAuth, getMyChallenges)

export default router
