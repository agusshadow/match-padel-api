import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import {
  listTournaments,
  getTournament,
  createTournament,
  registerTeam,
  withdrawTeam,
  startTournament,
} from './tournament.controller'

const router = Router()

// Public
router.get('/', listTournaments)
router.get('/:id', getTournament)

// Authenticated
router.post('/', requireAuth, createTournament)
router.post('/:id/teams', requireAuth, registerTeam)
router.delete('/:id/teams/me', requireAuth, withdrawTeam)
router.post('/:id/start', requireAuth, startTournament)

export default router
