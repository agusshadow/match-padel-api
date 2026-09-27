import { Request, Response, NextFunction } from 'express'
import { userRepository } from './user.repository'
import { AuthenticatedRequest } from '../../middleware/auth'
import { NotFoundError } from '../../types/errors'

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const user = await userRepository.findByIdFull(userId)
    if (!user) {
      throw new NotFoundError('User')
    }
    res.json({ success: true, data: user })
  } catch (err) {
    next(err)
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const { first_name, last_name, phone, avatar_url, skill_level, preferred_hand } = req.body
    const user = await userRepository.update(userId, {
      first_name,
      last_name,
      phone,
      avatar_url,
      skill_level,
      preferred_hand,
    })
    res.json({ success: true, data: user })
  } catch (err) {
    next(err)
  }
}

export async function getMyStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const stats = await userRepository.getStats(userId)
    res.json({ success: true, data: stats })
  } catch (err) {
    next(err)
  }
}

export async function getUserByUsername(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { username } = req.params
    const user = await userRepository.findByUsername(username)
    if (!user) {
      throw new NotFoundError('User')
    }
    res.json({ success: true, data: user })
  } catch (err) {
    // Supabase returns PGRST116 for no rows
    if ((err as any)?.code === 'PGRST116') {
      next(new NotFoundError('User'))
      return
    }
    next(err)
  }
}
