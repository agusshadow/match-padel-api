import { Request, Response, NextFunction } from 'express'
import { ensureAccess } from '../../middleware/access.middleware'
import { getMyAccess } from './access.service'

export async function getAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const access = await ensureAccess(req)
    const data = await getMyAccess(access)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}
