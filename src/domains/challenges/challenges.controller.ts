import { Request, Response, NextFunction } from 'express'
import { challengesService } from './challenges.service'
import { AuthenticatedRequest } from '../../middleware/auth'

export async function getCatalog(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const challenges = await challengesService.getCatalog()
    res.json({ success: true, data: challenges })
  } catch (err) {
    next(err)
  }
}

export async function getMyChallenges(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const challenges = await challengesService.getMyChallenges(userId)
    res.json({ success: true, data: challenges })
  } catch (err) {
    next(err)
  }
}
