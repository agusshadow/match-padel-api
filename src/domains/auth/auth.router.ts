import { Router } from 'express'
import { register, login, logout, me } from './auth.controller'
import { requireAuth } from '../../middleware/auth'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/logout', requireAuth, logout)
router.get('/me', requireAuth, me)

export const authRouter = router
export default router
