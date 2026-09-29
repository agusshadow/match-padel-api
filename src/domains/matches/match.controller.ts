import { Request, Response, NextFunction } from 'express'
import { matchService } from './match.service'
import { AuthenticatedRequest } from '../../middleware/auth'
import { ValidationError } from '../../types/errors'

export async function getMyMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const { status, type, page } = req.query as Record<string, string>
    const matches = await matchService.getMyMatches(userId, {
      status,
      type,
      page: page ? parseInt(page, 10) : 1,
    })
    res.json({ success: true, data: matches })
  } catch (err) {
    next(err)
  }
}

export async function getMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const match = await matchService.getMatchById(req.params.id, userId)
    res.json({ success: true, data: match })
  } catch (err) {
    next(err)
  }
}

export async function createMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const { type, is_ranked, club_id } = req.body

    if (!type) {
      throw new ValidationError('Match type is required')
    }

    const match = await matchService.createMatch({ type, is_ranked: !!is_ranked, club_id }, userId)
    res.status(201).json({ success: true, data: match })
  } catch (err) {
    next(err)
  }
}

export async function joinByLobbyUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const { lobbyUrl } = req.params
    const match = await matchService.joinByLobbyUrl(lobbyUrl, userId)
    res.json({ success: true, data: match })
  } catch (err) {
    next(err)
  }
}

export async function submitScore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const { id } = req.params
    const { score_team1, score_team2 } = req.body

    if (!Array.isArray(score_team1) || !Array.isArray(score_team2)) {
      throw new ValidationError('score_team1 and score_team2 must be arrays')
    }

    const match = await matchService.submitScore(id, { score_team1, score_team2 }, userId)
    res.json({ success: true, data: match })
  } catch (err) {
    next(err)
  }
}

export async function acceptScore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const { id } = req.params
    const match = await matchService.acceptScore(id, userId)
    res.json({ success: true, data: match })
  } catch (err) {
    next(err)
  }
}

export async function rejectScore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const { id } = req.params
    const match = await matchService.rejectScore(id, userId)
    res.json({ success: true, data: match })
  } catch (err) {
    next(err)
  }
}

export async function cancelMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const { id } = req.params
    const match = await matchService.cancelMatch(id, userId)
    res.json({ success: true, data: match })
  } catch (err) {
    next(err)
  }
}
