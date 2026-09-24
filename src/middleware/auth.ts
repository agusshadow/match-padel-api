import { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'
import { UnauthorizedError } from '../types/errors'

export interface AuthenticatedRequest extends Request {
  userId: string
  userRole: string
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid Authorization header')
    }

    const token = authHeader.slice(7)
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      throw new UnauthorizedError('Invalid or expired token')
    }

    // Attach userId to request for downstream handlers
    ;(req as AuthenticatedRequest).userId = user.id
    next()
  } catch (err) {
    next(err)
  }
}
