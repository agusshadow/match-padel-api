import { Request, Response, NextFunction } from 'express'
import { achievementsService } from './achievements.service'
import { AuthenticatedRequest } from '../../middleware/auth'

export async function getCatalog(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const achievements = await achievementsService.getCatalog()
    res.json({ success: true, data: achievements })
  } catch (err) {
    next(err)
  }
}

export async function getMyAchievements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const achievements = await achievementsService.getMyAchievements(userId)
    res.json({ success: true, data: achievements })
  } catch (err) {
    next(err)
  }
}
