import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AuthenticatedRequest } from '../../middleware/auth'
import { UnauthorizedError } from '../../types/errors'
import { logger } from '../../lib/logger'
import { createPaymentPreference, handleWebhook, verifyWebhookSignature } from './payment.service'

function getUserId(req: Request): string {
  const userId = (req as AuthenticatedRequest).userId
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
  _next: NextFunction,
): Promise<void> {
  const dataId = typeof req.query['data.id'] === 'string' ? req.query['data.id'] : undefined
  const isValid = verifyWebhookSignature(
    req.headers['x-signature'] as string | undefined,
    req.headers['x-request-id'] as string | undefined,
    dataId,
  )

  if (!isValid) {
    logger.warn({ dataId }, 'Rejected MercadoPago webhook: invalid or missing signature')
    res.sendStatus(401)
    return
  }

  // Respond 200 immediately so MP doesn't retry; the actual processing happens after.
  res.sendStatus(200)

  try {
    await handleWebhook(req.body as Record<string, unknown>, dataId)
  } catch (err) {
    // Headers are already sent — this can't reach the error middleware, so log it directly
    // instead of letting it disappear silently.
    logger.error({ err, body: req.body }, 'Unhandled error processing MercadoPago webhook')
  }
}
