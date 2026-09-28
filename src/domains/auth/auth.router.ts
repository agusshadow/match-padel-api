import { Router } from 'express'
import { register, login, logout, me } from './auth.controller'
import { requireAuth } from '../../middleware/auth'
import { authLimiter } from '../../middleware/rate-limit'

const router = Router()

router.post('/register', authLimiter, register)
router.post('/login', authLimiter, login)
router.post('/logout', requireAuth, logout)
router.get('/me', requireAuth, me)

export const authRouter = router
export default router
