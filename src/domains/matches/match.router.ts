import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import {
  getMyMatches,
  getMatch,
  createMatch,
  joinByLobbyUrl,
  submitScore,
  cancelMatch,
  leaveMatch,
} from './match.controller'
import chatRouter from '../chats/chat.router'

const router = Router()

router.use(requireAuth)

// GET /api/v1/matches — my matches
router.get('/', getMyMatches)
// GET /api/v1/matches/:id — match detail
router.get('/:id', getMatch)
// POST /api/v1/matches — create match
router.post('/', createMatch)
// POST /api/v1/matches/join/:lobbyUrl — join by lobby URL
router.post('/join/:lobbyUrl', joinByLobbyUrl)
// PUT /api/v1/matches/:id/score — submit your team's claimed result; confirms
// automatically once both teams' drafts agree (card #58)
router.put('/:id/score', submitScore)
// DELETE /api/v1/matches/:id — cancel match (creator only)
router.delete('/:id', cancelMatch)
// DELETE /api/v1/matches/:id/leave — leave a match you joined
router.delete('/:id/leave', leaveMatch)
// GET/POST /api/v1/matches/:id/chat — card #59, chat scoped to this match's players
router.use('/:id/chat', chatRouter)

export default router
