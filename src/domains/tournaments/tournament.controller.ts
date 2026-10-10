import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { tournamentService } from './tournament.service'
import { AuthenticatedRequest } from '../../middleware/auth'
import { NotFoundError } from '../../types/errors'
import { publicListQuerySchema, registerTeamSchema } from './tournament.validator'

// Player-facing tournament routes. Since card #77 players only list, follow,
// register and withdraw: tournaments are created and managed by clubs from the
// panel (tournament-admin.controller.ts).

const idSchema = z.string().uuid()

function parseId(value: string): string {
  const parsed = idSchema.safeParse(value)
  if (!parsed.success) throw new NotFoundError('Tournament')
  return parsed.data
}

export async function listTournaments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = publicListQuerySchema.parse(req.query)
    const result = await tournamentService.listTournaments(query)
    res.json({ success: true, data: result.items, meta: { total: result.total } })
  } catch (err) {
    next(err)
  }
}

export async function getTournament(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tournament = await tournamentService.getTournamentById(parseId(req.params.id))
    res.json({ success: true, data: tournament })
  } catch (err) {
    next(err)
  }
}

/** Closed (card #77): 403 TOURNAMENTS_MANAGED_BY_CLUBS, or 410 pointing staff to the club panel endpoint. */
export async function createTournament(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const club = z.string().uuid().safeParse((req.body as { club_id?: unknown } | undefined)?.club_id)
    await tournamentService.rejectPlayerSideManagement(userId, { clubId: club.success ? club.data : undefined })
  } catch (err) {
    next(err)
  }
}

export async function registerTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const parsed = registerTeamSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid data', details: parsed.error.flatten() } })
      return
    }
    const team = await tournamentService.registerTeam(
      parseId(req.params.id),
      userId,
      parsed.data.partner_id,
      parsed.data.team_name,
    )
    res.status(201).json({ success: true, data: team })
  } catch (err) {
    next(err)
  }
}

export async function withdrawTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const result = await tournamentService.withdrawTeam(parseId(req.params.id), userId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

/** Closed (card #77): starting is `POST /club-admin/:clubId/tournaments/:id/start`. */
export async function startTournament(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    await tournamentService.rejectPlayerSideManagement(userId, { tournamentId: parseId(req.params.id) })
  } catch (err) {
    next(err)
  }
}
