import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { tournamentService } from './tournament.service'
import { AuthenticatedRequest } from '../../middleware/auth'

const createTournamentSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  club_id: z.string().uuid().optional(),
  format: z.enum(['round_robin', 'single_elimination', 'double_elimination', 'americano']),
  max_teams: z.number().int().min(2).max(64),
  entry_fee: z.number().min(0).optional(),
  prize_pool: z.number().min(0).optional(),
  rules: z.record(z.unknown()).optional(),
  start_date: z.string().datetime(),
  end_date: z.string().datetime().optional(),
})

const registerTeamSchema = z.object({
  partner_id: z.string().uuid(),
  team_name: z.string().min(2).max(50).optional(),
})

export async function listTournaments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, page, limit } = req.query
    const result = await tournamentService.listTournaments({
      status: status as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    })
    res.json({ success: true, data: result.items, meta: { total: result.total } })
  } catch (err) {
    next(err)
  }
}

export async function getTournament(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tournament = await tournamentService.getTournamentById(req.params.id)
    res.json({ success: true, data: tournament })
  } catch (err) {
    next(err)
  }
}

export async function createTournament(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const parsed = createTournamentSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid data', details: parsed.error.flatten() } })
      return
    }
    const tournament = await tournamentService.createTournament(parsed.data, userId)
    res.status(201).json({ success: true, data: tournament })
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
      req.params.id,
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
    const result = await tournamentService.withdrawTeam(req.params.id, userId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function startTournament(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const tournament = await tournamentService.startTournament(req.params.id, userId)
    res.json({ success: true, data: tournament })
  } catch (err) {
    next(err)
  }
}
