import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AuthRequest } from '../../middleware/auth.middleware'
import { UnauthorizedError } from '../../types/errors'
import { createPaymentPreference, handleWebhook } from './payment.service'

function getUserId(req: Request): string {
  const userId = (req as AuthRequest).userId
  if (!userId) throw new UnauthorizedError()
  return userId
}

const createPreferenceSchema = z.object({
  reservation_id: z.string().uuid(),
})

export async function createPreference(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = getUserId(req)
    const { reservation_id } = createPreferenceSchema.parse(req.body)

    const result = await createPaymentPreference(reservation_id, userId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function webhook(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Respond 200 immediately so MP doesn't retry
    res.sendStatus(200)

    await handleWebhook(req.body as Record<string, unknown>)
  } catch (err) {
    next(err)
  }
}
