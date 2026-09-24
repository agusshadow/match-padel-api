import { Request, Response, NextFunction } from 'express'
import { notificationService } from './notification.service'
import { AuthenticatedRequest } from '../../middleware/auth'

export async function getMyNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req as AuthenticatedRequest
    const page = Math.max(0, parseInt(req.query.page as string) || 0)
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20)

    const result = await notificationService.getMyNotifications(userId, { page, limit })
    res.json({
      success: true,
      data: result.items,
      meta: { total: result.total, page, limit, hasMore: (page + 1) * limit < result.total },
    })
  } catch (err) {
    next(err)
  }
}

export async function getUnreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req as AuthenticatedRequest
    const count = await notificationService.getUnreadCount(userId)
    res.json({ success: true, data: { count } })
  } catch (err) {
    next(err)
  }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req as AuthenticatedRequest
    const { id } = req.params
    await notificationService.markAsRead(id, userId)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

export async function markAllAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req as AuthenticatedRequest
    await notificationService.markAllAsRead(userId)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}
