import { Router } from 'express'
import { getMessages, sendMessage } from './chat.controller'

// Mounted at /api/v1/matches/:id/chat with mergeParams so :id (the match id)
// is visible here — auth is already applied by the parent matches router.
const router = Router({ mergeParams: true })

// GET /api/v1/matches/:id/chat — messages for this match, oldest first
router.get('/', getMessages)
// POST /api/v1/matches/:id/chat — post a message
router.post('/', sendMessage)

export default router
