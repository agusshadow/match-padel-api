import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import {
  getMyMatches,
  getMatch,
  createMatch,
  joinByLobbyUrl,
  submitScore,
  acceptScore,
  rejectScore,
  cancelMatch,
} from './match.controller'

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
// PUT /api/v1/matches/:id/score — submit score
router.put('/:id/score', submitScore)
// PUT /api/v1/matches/:id/score/accept — accept score
router.put('/:id/score/accept', acceptScore)
// PUT /api/v1/matches/:id/score/reject — reject score
router.put('/:id/score/reject', rejectScore)
// DELETE /api/v1/matches/:id — cancel match
router.delete('/:id', cancelMatch)

export default router
