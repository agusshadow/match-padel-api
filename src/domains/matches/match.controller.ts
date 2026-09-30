import { Request, Response, NextFunction } from 'express'
import { matchService } from './match.service'
import { AuthenticatedRequest } from '../../middleware/auth'
import { CreateMatchSchema, SubmitScoreSchema } from './match.validator'

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
    const data = CreateMatchSchema.parse(req.body)

    const result = await matchService.createMatch(data, userId)
    res.status(201).json({ success: true, data: result })
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
    const score = SubmitScoreSchema.parse(req.body)

    const match = await matchService.submitScore(id, score, userId)
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

export async function leaveMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const { id } = req.params
    const result = await matchService.leaveMatch(id, userId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}
