import { Request, Response, NextFunction } from 'express'
import { chatService } from './chat.service'
import { AuthenticatedRequest } from '../../middleware/auth'
import { SendMessageSchema } from './chat.validator'

export async function getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const { id } = req.params
    const messages = await chatService.getMessages(id, userId)
    res.json({ success: true, data: messages })
  } catch (err) {
    next(err)
  }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req as AuthenticatedRequest
    const { id } = req.params
    const { message } = SendMessageSchema.parse(req.body)
    const created = await chatService.sendMessage(id, userId, message)
    res.status(201).json({ success: true, data: created })
  } catch (err) {
    next(err)
  }
}
