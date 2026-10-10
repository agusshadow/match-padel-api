import { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../../middleware/auth'
import { clubParamsSchema } from '../club-admin/club-admin.validator'
import { tournamentService } from './tournament.service'
import {
  cancelTournamentSchema,
  createTournamentSchema,
  listTournamentsQuerySchema,
  recordResultSchema,
  startTournamentSchema,
  tournamentMatchParamsSchema,
  tournamentParamsSchema,
  updateTournamentSchema,
} from './tournament.validator'

// Club panel: /club-admin/:clubId/tournaments. Authorization (owner/admin of the
// club, or a platform superadmin) is the router's `requireClubRole`; every
// service call is scoped to `clubId`, so a tournament of another club is 404.

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId } = clubParamsSchema.parse(req.params)
    const query = listTournamentsQuerySchema.parse(req.query)
    const { data, meta } = await tournamentService.listClubTournaments(clubId, query)
    res.json({ success: true, data, meta })
  } catch (err) {
    next(err)
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId } = clubParamsSchema.parse(req.params)
    const input = createTournamentSchema.parse(req.body)
    const { userId } = req as AuthenticatedRequest
    res.status(201).json({ success: true, data: await tournamentService.createClubTournament(clubId, userId, input) })
  } catch (err) {
    next(err)
  }
}

export async function detail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, id } = tournamentParamsSchema.parse(req.params)
    res.json({ success: true, data: await tournamentService.getClubTournament(clubId, id) })
  } catch (err) {
    next(err)
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, id } = tournamentParamsSchema.parse(req.params)
    const patch = updateTournamentSchema.parse(req.body)
    const { userId } = req as AuthenticatedRequest
    res.json({ success: true, data: await tournamentService.updateClubTournament(clubId, id, userId, patch) })
  } catch (err) {
    next(err)
  }
}

export async function publish(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, id } = tournamentParamsSchema.parse(req.params)
    const { userId } = req as AuthenticatedRequest
    res.json({ success: true, data: await tournamentService.publishClubTournament(clubId, id, userId) })
  } catch (err) {
    next(err)
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, id } = tournamentParamsSchema.parse(req.params)
    const { reason } = cancelTournamentSchema.parse(req.body ?? {})
    const { userId } = req as AuthenticatedRequest
    res.json({ success: true, data: await tournamentService.cancelClubTournament(clubId, id, userId, reason ?? null) })
  } catch (err) {
    next(err)
  }
}

export async function start(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, id } = tournamentParamsSchema.parse(req.params)
    const options = startTournamentSchema.parse(req.body ?? {})
    const { userId } = req as AuthenticatedRequest
    res.json({ success: true, data: await tournamentService.startClubTournament(clubId, id, userId, options) })
  } catch (err) {
    next(err)
  }
}

export async function recordResult(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, id, matchId } = tournamentMatchParamsSchema.parse(req.params)
    const input = recordResultSchema.parse(req.body)
    const { userId } = req as AuthenticatedRequest
    res.json({ success: true, data: await tournamentService.recordClubResult(clubId, id, matchId, userId, input) })
  } catch (err) {
    next(err)
  }
}

export async function standings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, id } = tournamentParamsSchema.parse(req.params)
    res.json({ success: true, data: await tournamentService.getClubStandings(clubId, id) })
  } catch (err) {
    next(err)
  }
}
