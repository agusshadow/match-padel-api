import { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../../middleware/auth'
import * as service from './club-mercadopago.service'
import { callbackQuerySchema, clubParamsSchema } from './club-mercadopago.validator'

// POST /club-admin/:clubId/mercadopago/connect
export async function connect(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId } = clubParamsSchema.parse(req.params)
    const { userId } = req as AuthenticatedRequest
    res.set('Cache-Control', 'no-store')
    res.json({ success: true, data: await service.startConnect(clubId, userId) })
  } catch (err) {
    next(err)
  }
}

// GET /club-admin/:clubId/mercadopago
export async function getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId } = clubParamsSchema.parse(req.params)
    res.set('Cache-Control', 'no-store')
    res.json({ success: true, data: await service.getStatus(clubId) })
  } catch (err) {
    next(err)
  }
}

// DELETE /club-admin/:clubId/mercadopago
export async function disconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId } = clubParamsSchema.parse(req.params)
    const { userId } = req as AuthenticatedRequest
    res.json({ success: true, data: await service.disconnect(clubId, userId) })
  } catch (err) {
    next(err)
  }
}

// GET /mercadopago/oauth/callback (public: it is the browser coming back from Mercado Pago)
export async function oauthCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = callbackQuerySchema.safeParse(req.query)
    const { redirectTo } = await service.completeCallback(parsed.success ? parsed.data : null)
    // The URL that reached us carries the authorization code: keep it out of Referer and caches.
    res.set('Cache-Control', 'no-store')
    res.set('Referrer-Policy', 'no-referrer')
    res.redirect(302, redirectTo)
  } catch (err) {
    next(err)
  }
}
